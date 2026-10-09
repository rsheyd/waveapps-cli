# waveapps-cli

A dependency-free Node.js CLI for listing Wave records and creating customers, sellable products, invoices, and estimates from the terminal. It uses Wave's public GraphQL API and reads a personal full-access token from the environment.

## Requirements

- Node.js 18 or newer
- A Wave full-access token in `WAVEAPPS_FULL_ACCESS_TOKEN`

The client ID and client secret are not needed for a CLI that only accesses your own Wave account.

## Install

From this directory:

```sh
npm link
```

Add the token to `.zshrc` without putting it in this repository:

```sh
export WAVEAPPS_FULL_ACCESS_TOKEN="your-token"
```

Open a new terminal afterward, or load it into the current interactive shell with `source ~/.zshrc`. Confirm that the variable exists without printing its secret value:

```sh
test -n "$WAVEAPPS_FULL_ACCESS_TOKEN" && echo "Wave token is set"
```

Do not paste the token into command arguments, logs, invoice files, or committed configuration.

## Command reference

```text
waveapps businesses
waveapps customers --business BUSINESS_ID
waveapps customers create --business ID --name NAME [--email EMAIL] [--currency USD] [--submit]
waveapps products --business BUSINESS_ID
waveapps products create --business ID --name NAME --price PRICE --income-account ID [--description TEXT] [--submit]
waveapps products rename --product ID --name NEW_NAME [--submit]
waveapps products delete --product ID [--submit]
waveapps accounts --business BUSINESS_ID
waveapps estimates create --file estimate.json [--submit]
waveapps estimates update --business ID --estimate ID --file patch.json [--submit]
waveapps invoices create --file invoice.json [--submit]
waveapps invoices update --business ID --invoice NUMBER --file patch.json [--submit]
waveapps invoices set-number --business ID --invoice CURRENT --number NEW [--submit]
waveapps help
```

Every mutation command is a dry run by default. It displays the exact API input and makes no Wave mutation until `--submit` is supplied.

## Find Wave IDs

```sh
waveapps businesses
waveapps customers --business BUSINESS_ID
waveapps products --business BUSINESS_ID
waveapps accounts --business BUSINESS_ID
```

The `customers` and `products` list commands show the IDs needed in invoice JSON. `products` shows active sellable products. The `accounts` command lists valid active income accounts needed to create a sellable product.

## Create customers and products

Preview a new customer, then create it:

```sh
waveapps customers create --business BUSINESS_ID --name "Jane Example"
waveapps customers create --business BUSINESS_ID --name "Jane Example" --submit
```

Optional customer fields are `--email` and `--currency`.

Find an income account with `waveapps accounts --business BUSINESS_ID`, then preview and create a product:

```sh
waveapps products create --business BUSINESS_ID --name "On-Site IT Support" --price 80.00 --income-account INCOME_ACCOUNT_ID --description "Hourly support at discounted rate"
waveapps products create --business BUSINESS_ID --name "On-Site IT Support" --price 80.00 --income-account INCOME_ACCOUNT_ID --description "Hourly support at discounted rate" --submit
```

Customer and product creation are dry runs unless `--submit` is present.

Rename a product or archive it from active use by its ID:

```sh
waveapps products rename --product PRODUCT_ID --name "New service name"
waveapps products rename --product PRODUCT_ID --name "New service name" --submit
waveapps products delete --product PRODUCT_ID
waveapps products delete --product PRODUCT_ID --submit
```

Both commands are dry runs unless `--submit` is present. Wave's API does not permanently delete products: `products delete` uses Wave's `productArchive` mutation, preserving historical invoice references while removing the product from active product listings.

For reimbursements, create separate products if you want them to appear as distinct invoice lines:

```sh
waveapps products create --business BUSINESS_ID --name "Parking Reimbursement" --price 17.00 --income-account INCOME_ACCOUNT_ID --submit
waveapps products create --business BUSINESS_ID --name "NYC Congestion Fee Reimbursement" --price 9.00 --income-account INCOME_ACCOUNT_ID --submit
```

Choose the income account that matches your bookkeeping practice. If Wave has no dedicated reimbursed-expense income account, confirm the appropriate account with your accountant.

## Build an invoice file

Copy `examples/invoice.json`, then replace its placeholder IDs and edit the invoice fields. Each line item must reference an existing Wave product or service. `description`, `quantity`, and `unitPrice` can override the product defaults.

For example, three hours at an $80 hourly rate plus $17 and $9 reimbursements can be represented as:

```json
{
  "businessId": "BUSINESS_ID",
  "customerId": "CUSTOMER_ID",
  "status": "DRAFT",
  "invoiceDate": "2026-01-15",
  "dueDate": "2026-02-14",
  "title": "IT Support",
  "items": [
    {
      "productId": "IT_SUPPORT_PRODUCT_ID",
      "description": "On-site IT support and account setup",
      "quantity": "3",
      "unitPrice": "80.00"
    },
    {
      "productId": "PARKING_PRODUCT_ID",
      "quantity": "1",
      "unitPrice": "17.00"
    },
    {
      "productId": "CONGESTION_FEE_PRODUCT_ID",
      "quantity": "1",
      "unitPrice": "9.00"
    }
  ]
}
```

This example totals $266 before any taxes configured in Wave. Use current dates and IDs rather than copying the placeholders literally.

## Preview and create an estimate

Copy `examples/estimate.json` and replace the business, customer, and product IDs. The input follows Wave's `EstimateCreateInput`: use `estimateNumber`, `estimateDate`, `title`, `subhead`, `memo`, and `footer` for quote details. Each item requires `productId` and an explicit non-negative `unitPrice`; `quantity` is optional. Creation supports only `DRAFT`, which the CLI supplies if omitted. `estimateDate` defaults to today in UTC; `dueDate` (Wave's Valid Until date) defaults to 30 calendar days after `estimateDate`. Explicit dates override these defaults. Omit `subhead` for no custom subtitle.

```sh
waveapps estimates create --file my-estimate.json
waveapps estimates create --file my-estimate.json --submit
```

The first command previews the API input. The second creates a draft estimate and prints its number and customer view URL. It does not approve, email, or convert the estimate to an invoice. Review the draft in Wave before sharing it. For capped hourly work, explain the authorization ceiling and actual-hours billing in the memo; create subsequent invoices from actual hours rather than invoicing the full ceiling.

To update an existing draft, use `waveapps estimates update --business ID --estimate ID --file patch.json`, adding `--submit` after reviewing the dry run. Supply the estimate's global ID, not its displayed number. Patch JSON supports string values for `title`, `subhead`, `memo`, `footer`, `dueDate`, `estimateNumber`, and `poNumber`; use `"subhead": ""` to remove the subtitle. The command fetches and preserves line items, taxes, discounts, attachments, numbering, and settings before applying changes because Wave can clear omitted fields. Updates to non-draft estimates are refused.

API reference: [Wave estimate inputs and mutations](https://developer.waveapps.com/hc/en-us/articles/360019968212-API-Reference).

## Preview and create an invoice

Previewing is the default and does not contact the invoice mutation:

```sh
waveapps invoices create --file my-invoice.json
```

After reviewing the exact input, explicitly submit it:

```sh
waveapps invoices create --file my-invoice.json --submit
```

Use `"status": "DRAFT"` while testing. `"SAVED"` approves/saves the invoice in Wave. This command creates an invoice but does not email it.

## Invoice numbering

Wave generates the next invoice number when `invoiceNumber` is omitted from the invoice JSON. To choose a unique number during creation, add a field such as `"invoiceNumber": "CLIENT-2026-001"`.

To change an existing invoice number, identify it by its current exact number. Preview the change first, then submit it:

```sh
waveapps invoices set-number --business BUSINESS_ID --invoice CURRENT_NUMBER --number NEW_NUMBER
waveapps invoices set-number --business BUSINESS_ID --invoice CURRENT_NUMBER --number NEW_NUMBER --submit
```

Invoice numbers must be unique within Wave. The lookup checks for an exact match even though Wave's API performs a contains-style search.

## Update an invoice

Use a JSON patch file to update an existing invoice identified by its exact current invoice number. The file may contain fields accepted by Wave's `InvoicePatchInput`, including items, discounts, dates, memo, footer, and invoice number.

Preview and submit an update:

```sh
waveapps invoices update --business BUSINESS_ID --invoice INVOICE_NUMBER --file invoice-update.json
waveapps invoices update --business BUSINESS_ID --invoice INVOICE_NUMBER --file invoice-update.json --submit
```

See `examples/invoice-update.json` for an update that restores a standard hourly price and applies a fixed discount only to services. Providing `items` replaces all existing invoice items, so include every line that should remain. The patch file must not contain an invoice `id`; the CLI resolves it from the exact invoice number.

## Safety and limitations

- `--submit` creates or changes a real record in Wave.
- `products delete` archives rather than permanently deleting a product because that is the removal operation Wave's API provides.
- Invoice creation does not email the invoice or charge the customer.
- Customer creation supports name, email, and currency. Add addresses or other details in Wave afterward.
- Invoice updates can replace items and discounts but do not send or approve the invoice unless the supplied patch explicitly changes supported status fields.
- Product creation requires an income-account ID so the product is sellable and usable on an invoice.
- Lookup commands currently return the first 100 records of each type.
- The CLI never needs `WAVEAPPS_CLIENT_ID` or `WAVEAPPS_CLIENT_SECRET` for personal full-access-token use.

## Development

```sh
npm test
npm run check
```

The tests use mocked HTTP responses and never access Wave.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, [CHANGELOG.md](CHANGELOG.md) for release history, and [SECURITY.md](SECURITY.md) for reporting security issues.

## API documentation

- [Create invoice](https://developer.waveapps.com/hc/en-us/articles/360038817812-Mutation-Create-invoice)
- [Patch invoice](https://developer.waveapps.com/hc/en-us/articles/11224977033364-Mutation-Patch-Invoice)
- [Create customer](https://developer.waveapps.com/hc/en-us/articles/360032569232-Mutation-Create-customer)
- [Create product/service](https://developer.waveapps.com/hc/en-us/articles/360033284492-Mutation-Create-product-service)
- [Wave API reference for product patch and archive](https://developer.waveapps.com/hc/en-us/articles/360019968212-API-Reference)
