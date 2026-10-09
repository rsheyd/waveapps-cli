export const WAVE_API_URL = 'https://gql.waveapps.com/graphql/public';

export class WaveClient {
  constructor({ token, fetchImpl = globalThis.fetch, endpoint = WAVE_API_URL } = {}) {
    if (!token) throw new Error('WAVEAPPS_FULL_ACCESS_TOKEN is not set');
    if (!fetchImpl) throw new Error('This CLI requires Node.js 18 or newer');
    this.token = token;
    this.fetch = fetchImpl;
    this.endpoint = endpoint;
  }

  async request(query, variables = {}) {
    let response;
    try {
      response = await this.fetch(this.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.token}`,
          'content-type': 'application/json',
          'user-agent': 'waveapps-cli/0.1.0'
        },
        body: JSON.stringify({ query, variables })
      });
    } catch (error) {
      throw new Error(`Could not reach Wave: ${error.message}`);
    }

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Wave returned an invalid response (HTTP ${response.status})`);
    }

    if (!response.ok) throw new Error(formatErrors(payload.errors) || `Wave returned HTTP ${response.status}`);
    if (payload.errors?.length) throw new Error(formatErrors(payload.errors));
    return payload.data;
  }

  async businesses() {
    const data = await this.request(`query Businesses {
      businesses(page: 1, pageSize: 100) {
        edges { node { id name isPersonal } }
      }
    }`);
    return data.businesses.edges.map(({ node }) => node);
  }

  async customers(businessId) {
    const data = await this.request(`query Customers($businessId: ID!) {
      business(id: $businessId) {
        customers(page: 1, pageSize: 100, sort: [NAME_ASC]) {
          edges { node { id name email } }
        }
      }
    }`, { businessId });
    return data.business.customers.edges.map(({ node }) => node);
  }

  async products(businessId) {
    const data = await this.request(`query Products($businessId: ID!) {
      business(id: $businessId) {
        products(page: 1, pageSize: 100) {
          edges { node { id name description unitPrice isSold isArchived } }
        }
      }
    }`, { businessId });
    return data.business.products.edges.map(({ node }) => node);
  }

  async incomeAccounts(businessId) {
    const data = await this.request(`query IncomeAccounts($businessId: ID!) {
      business(id: $businessId) {
        accounts(page: 1, pageSize: 100, subtypes: [INCOME, DISCOUNTS, OTHER_INCOME]) {
          edges { node { id name subtype { value } isArchived } }
        }
      }
    }`, { businessId });
    return data.business.accounts.edges.map(({ node }) => node);
  }

  async createCustomer(input) {
    const data = await this.request(`mutation CreateCustomer($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        didSucceed
        inputErrors { message code path }
        customer { id name email currency { code } }
      }
    }`, { input });
    const result = data.customerCreate;
    if (!result.didSucceed) throw new Error(formatInputErrors(result.inputErrors));
    return result.customer;
  }

  async createProduct(input) {
    const data = await this.request(`mutation CreateProduct($input: ProductCreateInput!) {
      productCreate(input: $input) {
        didSucceed
        inputErrors { message code path }
        product { id name description unitPrice isSold incomeAccount { id name } }
      }
    }`, { input });
    const result = data.productCreate;
    if (!result.didSucceed) throw new Error(formatInputErrors(result.inputErrors));
    return result.product;
  }

  async patchProduct(input) {
    const data = await this.request(`mutation PatchProduct($input: ProductPatchInput!) {
      productPatch(input: $input) {
        didSucceed
        inputErrors { message code path }
        product { id name description unitPrice isSold isBought isArchived }
      }
    }`, { input });
    const result = data.productPatch;
    if (!result.didSucceed) throw new Error(formatInputErrors(result.inputErrors, 'update the product'));
    return result.product;
  }

  async archiveProduct(id) {
    const data = await this.request(`mutation ArchiveProduct($input: ProductArchiveInput!) {
      productArchive(input: $input) {
        didSucceed
        inputErrors { message code path }
        product { id name isArchived }
      }
    }`, { input: { id } });
    const result = data.productArchive;
    if (!result.didSucceed) throw new Error(formatInputErrors(result.inputErrors, 'archive the product'));
    return result.product;
  }

  async prepareEstimateUpdate(businessId, id, patch) {
    const scalars = ['id', 'status', 'title', 'subhead', 'estimateNumber', 'poNumber', 'estimateDate', 'dueDate', 'exchangeRate', 'memo', 'footer', 'disableAmexPayments', 'disableCreditCardPayments', 'disableBankPayments', 'itemTitle', 'unitTitle', 'priceTitle', 'amountTitle', 'hideName', 'hideDescription', 'hideUnit', 'hidePrice', 'hideAmount', 'requireTermsOfServiceAgreement', 'depositStatus', 'depositValue', 'depositUnit', 'dontCarryOverNotesToInvoice'];
    const data = await this.request(`query EstimateForUpdate($businessId: ID!, $id: ID!) {
      business(id: $businessId) { estimate(id: $id, embedAttachments: true) {
        ${scalars.join(' ')} customer { id } currency { code }
        items { product { id name } description quantity unitPrice taxes { salesTax { id } } }
        attachments { id }
        discounts { __typename ... on FixedEstimateDiscount { name amount } ... on PercentageEstimateDiscount { name percentage } }
      } }
    }`, { businessId, id });
    const estimate = data.business?.estimate;
    if (!estimate) throw new Error('Estimate was not found');
    if (estimate.status !== 'DRAFT') throw new Error('Only draft estimates can be updated');
    const input = Object.fromEntries(scalars.map(key => [key, estimate[key]]));
    input.customerId = estimate.customer.id;
    input.currency = estimate.currency.code;
    input.items = (estimate.items || []).map(item => ({ productId: item.product.id, name: item.product.name, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxes: item.taxes.map(tax => ({ salesTaxId: tax.salesTax.id })) }));
    input.attachmentIds = (estimate.attachments || []).map(attachment => attachment.id);
    input.discounts = (estimate.discounts || []).map(discount => {
      if (discount.__typename === 'FixedEstimateDiscount') return { name: discount.name, discountType: 'FIXED', amount: discount.amount };
      if (discount.__typename === 'PercentageEstimateDiscount') return { name: discount.name, discountType: 'PERCENTAGE', percentage: discount.percentage };
      throw new Error('Unsupported estimate discount type');
    });
    return { ...input, ...patch };
  }

  async updateEstimate(input) {
    const data = await this.request(`mutation UpdateEstimate($input: EstimatePatchInput!) {
      estimatePatch(input: $input) {
        didSucceed inputErrors { message code path }
        estimate { id estimateNumber status viewUrl }
      }
    }`, { input });
    if (!data.estimatePatch.didSucceed) throw new Error(formatInputErrors(data.estimatePatch.inputErrors, 'update the estimate'));
    return data.estimatePatch.estimate;
  }

  async createEstimate(input) {
    const data = await this.request(`mutation CreateEstimate($input: EstimateCreateInput!) {
      estimateCreate(input: $input) {
        didSucceed
        inputErrors { message code path }
        estimate { id estimateNumber status estimateDate dueDate viewUrl pdfUrl }
      }
    }`, { input });
    const result = data.estimateCreate;
    if (!result.didSucceed) throw new Error(formatInputErrors(result.inputErrors, 'create the estimate'));
    return result.estimate;
  }

  async createInvoice(input) {
    const data = await this.request(`mutation CreateInvoice($input: InvoiceCreateInput!) {
      invoiceCreate(input: $input) {
        didSucceed
        inputErrors { message code path }
        invoice {
          id invoiceNumber status invoiceDate dueDate viewUrl pdfUrl
          customer { id name }
          currency { code }
          total { value currency { symbol } }
        }
      }
    }`, { input });
    const result = data.invoiceCreate;
    if (!result.didSucceed) throw new Error(formatInputErrors(result.inputErrors));
    return result.invoice;
  }

  async invoiceByNumber(businessId, invoiceNumber) {
    const query = `query InvoiceByNumber($businessId: ID!, $invoiceNumber: String!, $page: Int!) {
      business(id: $businessId) {
        invoices(page: $page, pageSize: 100, invoiceNumber: $invoiceNumber) {
          pageInfo { totalPages }
          edges { node { id invoiceNumber status customer { name } } }
        }
      }
    }`;
    const matches = [];
    let page = 1;
    let totalPages = 1;
    do {
      const data = await this.request(query, { businessId, invoiceNumber, page });
      const invoices = data.business.invoices;
      matches.push(...invoices.edges.map(({ node }) => node).filter((invoice) => invoice.invoiceNumber === invoiceNumber));
      totalPages = invoices.pageInfo.totalPages;
      page += 1;
    } while (page <= totalPages);
    if (matches.length === 0) throw new Error(`Invoice ${invoiceNumber} was not found`);
    if (matches.length > 1) throw new Error(`Invoice number ${invoiceNumber} matched more than one invoice`);
    return matches[0];
  }

  async setInvoiceNumber(id, invoiceNumber) {
    return this.patchInvoice({ id, invoiceNumber });
  }

  async patchInvoice(input) {
    const data = await this.request(`mutation PatchInvoice($input: InvoicePatchInput!) {
      invoicePatch(input: $input) {
        didSucceed
        inputErrors { message code path }
        invoice { id invoiceNumber status customer { name } total { value currency { symbol } } }
      }
    }`, { input });
    const result = data.invoicePatch;
    if (!result.didSucceed) throw new Error(formatInputErrors(result.inputErrors));
    return result.invoice;
  }
}

function formatErrors(errors = []) {
  return errors.map((error) => error.message || String(error)).join('; ');
}

function formatInputErrors(errors = [], action = 'complete the request') {
  if (!errors.length) return `Wave did not ${action}`;
  return errors.map((error) => `${error.path?.join('.') || 'input'}: ${error.message}`).join('; ');
}
