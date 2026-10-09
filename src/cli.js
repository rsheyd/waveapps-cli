import { readFile } from 'node:fs/promises';
import { WaveClient } from './wave.js';

const HELP = `waveapps - manage Wave customers, products, invoices, and estimates from the terminal

Usage:
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

All mutation commands are dry runs unless --submit is present.
Authentication: WAVEAPPS_FULL_ACCESS_TOKEN must be exported in your shell.`;

export async function run(argv, options = {}) {
  const stdout = options.stdout || console.log;
  const stderr = options.stderr || console.error;
  const env = options.env || process.env;
  const clientFactory = options.clientFactory || ((config) => new WaveClient(config));
  const [command, subcommand] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    stdout(HELP);
    return;
  }

  const client = clientFactory({ token: env.WAVEAPPS_FULL_ACCESS_TOKEN });

  if (command === 'businesses') {
    printRows(await client.businesses(), ['id', 'name', 'isPersonal'], stdout);
    return;
  }

  if (command === 'customers') {
    if (subcommand === 'create') {
      const input = compactObject({
        businessId: requiredOption(argv, '--business'),
        name: requiredOption(argv, '--name'),
        email: optionalOption(argv, '--email'),
        currency: optionalOption(argv, '--currency')
      });
      if (!argv.includes('--submit')) return printDryRun(input, stdout, 'customer');
      const customer = await client.createCustomer(input);
      stdout(`Created customer ${customer.name}: ${customer.id}`);
      return;
    }
    const businessId = requiredOption(argv, '--business');
    printRows(await client.customers(businessId), ['id', 'name', 'email'], stdout);
    return;
  }

  if (command === 'products') {
    if (subcommand === 'create') {
      const unitPrice = requiredOption(argv, '--price');
      if (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0) throw new Error('--price must be a non-negative number');
      const input = compactObject({
        businessId: requiredOption(argv, '--business'),
        name: requiredOption(argv, '--name'),
        unitPrice,
        incomeAccountId: requiredOption(argv, '--income-account'),
        description: optionalOption(argv, '--description')
      });
      if (!argv.includes('--submit')) return printDryRun(input, stdout, 'product');
      const product = await client.createProduct(input);
      stdout(`Created product ${product.name}: ${product.id}`);
      return;
    }
    if (subcommand === 'rename') {
      const input = {
        id: requiredOption(argv, '--product'),
        name: requiredOption(argv, '--name')
      };
      if (!argv.includes('--submit')) return printDryRun(input, stdout, 'product rename', 'applied');
      const product = await client.patchProduct(input);
      stdout(`Renamed product to ${product.name}: ${product.id}`);
      return;
    }
    if (subcommand === 'delete') {
      const id = requiredOption(argv, '--product');
      const preview = { id, effect: 'Archive the product in Wave' };
      if (!argv.includes('--submit')) return printDryRun(preview, stdout, 'product archive', 'applied');
      const product = await client.archiveProduct(id);
      stdout(`Archived product ${product.name || id}: ${product.id || id}`);
      return;
    }
    const businessId = requiredOption(argv, '--business');
    const products = (await client.products(businessId)).filter((product) => product.isSold && !product.isArchived);
    printRows(products, ['id', 'name', 'unitPrice'], stdout);
    return;
  }

  if (command === 'accounts') {
    const businessId = requiredOption(argv, '--business');
    const accounts = (await client.incomeAccounts(businessId)).filter((account) => !account.isArchived);
    printRows(accounts.map((account) => ({ ...account, subtype: account.subtype?.value })), ['id', 'name', 'subtype'], stdout);
    return;
  }

  if (command === 'estimates' && subcommand === 'update') {
    const patch = JSON.parse(await readFile(requiredOption(argv, '--file'), 'utf8'));
    const allowed = ['title', 'subhead', 'memo', 'footer', 'dueDate', 'estimateNumber', 'poNumber'];
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length) throw new Error('Estimate patch must contain a JSON object with changes');
    for (const [key, value] of Object.entries(patch)) {
      if (!allowed.includes(key) || typeof value !== 'string') throw new Error(`Unsupported estimate patch field: ${key}`);
    }
    if (patch.dueDate !== undefined) validateEstimateDate(patch.dueDate);
    const input = await client.prepareEstimateUpdate(requiredOption(argv, '--business'), requiredOption(argv, '--estimate'), patch);
    if (!argv.includes('--submit')) return printDryRun(input, stdout, 'estimate update', 'applied');
    const estimate = await client.updateEstimate(input);
    stdout(`Updated estimate ${estimate.estimateNumber} (${estimate.status})`);
    if (estimate.viewUrl) stdout(estimate.viewUrl);
    return;
  }

  if (command === 'estimates' && subcommand === 'create') {
    const file = requiredOption(argv, '--file');
    const input = validateEstimate(JSON.parse(await readFile(file, 'utf8')));
    if (!argv.includes('--submit')) return printDryRun(input, stdout, 'estimate');
    const estimate = await client.createEstimate(input);
    stdout(`Created estimate ${estimate.estimateNumber || estimate.id} (${estimate.status})`);
    if (estimate.viewUrl) stdout(estimate.viewUrl);
    return;
  }

  if (command === 'invoices' && subcommand === 'create') {
    const file = requiredOption(argv, '--file');
    const input = validateInvoice(JSON.parse(await readFile(file, 'utf8')));
    if (!argv.includes('--submit')) {
      stdout('Dry run: no invoice was created. Add --submit to create it.');
      stdout(JSON.stringify(input, null, 2));
      return;
    }
    const invoice = await client.createInvoice(input);
    stdout(`Created invoice ${invoice.invoiceNumber || invoice.id} (${invoice.status})`);
    if (invoice.viewUrl) stdout(invoice.viewUrl);
    return;
  }

  if (command === 'invoices' && subcommand === 'set-number') {
    const businessId = requiredOption(argv, '--business');
    const currentNumber = requiredOption(argv, '--invoice');
    const newNumber = requiredOption(argv, '--number');
    if (currentNumber === newNumber) throw new Error('The new invoice number must be different');
    const invoice = await client.invoiceByNumber(businessId, currentNumber);
    const preview = { id: invoice.id, customer: invoice.customer?.name, currentNumber, newNumber };
    if (!argv.includes('--submit')) return printDryRun(preview, stdout, 'invoice number', 'changed');
    const updated = await client.setInvoiceNumber(invoice.id, newNumber);
    stdout(`Updated invoice ${currentNumber} to ${updated.invoiceNumber}`);
    return;
  }

  if (command === 'invoices' && subcommand === 'update') {
    const businessId = requiredOption(argv, '--business');
    const currentNumber = requiredOption(argv, '--invoice');
    const file = requiredOption(argv, '--file');
    const patch = validateInvoicePatch(JSON.parse(await readFile(file, 'utf8')));
    const invoice = await client.invoiceByNumber(businessId, currentNumber);
    const input = { id: invoice.id, ...patch };
    const preview = { customer: invoice.customer?.name, currentNumber, patch };
    if (!argv.includes('--submit')) return printDryRun(preview, stdout, 'invoice update', 'applied');
    const updated = await client.patchInvoice(input);
    stdout(`Updated invoice ${updated.invoiceNumber}`);
    if (updated.total) stdout(`Total: ${updated.total.currency.symbol}${updated.total.value}`);
    return;
  }

  stderr(`Unknown command: ${argv.join(' ')}`);
  throw new Error('Run waveapps help for usage');
}

export function validateEstimate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Estimate file must contain a JSON object');
  for (const field of ['businessId', 'customerId']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) throw new Error(`Estimate requires ${field}`);
  }
  if (!Array.isArray(value.items) || value.items.length === 0) throw new Error('Estimate requires at least one item');
  const decimal = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
  value.items.forEach((item, index) => {
    if (!item || typeof item.productId !== 'string' || !item.productId.trim()) throw new Error(`Estimate item ${index + 1} requires productId`);
    for (const field of ['quantity', 'unitPrice']) {
      if (field === 'quantity' && item[field] === undefined) continue;
      const amount = item[field];
      if (!['string', 'number'].includes(typeof amount) || !decimal.test(String(amount)) || !Number.isFinite(Number(amount))) {
        throw new Error(`Estimate item ${index + 1} has invalid ${field}`);
      }
    }
  });
  if (value.status !== undefined && value.status !== 'DRAFT') throw new Error('Estimate status must be DRAFT');
  const estimateDate = value.estimateDate ?? new Date().toISOString().slice(0, 10);
  validateEstimateDate(estimateDate);
  const expires = new Date(`${estimateDate}T00:00:00Z`);
  expires.setUTCDate(expires.getUTCDate() + 30);
  const dueDate = value.dueDate ?? expires.toISOString().slice(0, 10);
  validateEstimateDate(dueDate);
  return { ...value, status: 'DRAFT', estimateDate, dueDate };
}

function validateEstimateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error('Estimate date must be a valid YYYY-MM-DD date');
  }
}

export function validateInvoice(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invoice file must contain a JSON object');
  for (const field of ['businessId', 'customerId']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) throw new Error(`Invoice requires ${field}`);
  }
  if (!Array.isArray(value.items) || value.items.length === 0) throw new Error('Invoice requires at least one item');
  value.items.forEach((item, index) => {
    if (!item || typeof item.productId !== 'string' || !item.productId.trim()) throw new Error(`Invoice item ${index + 1} requires productId`);
    for (const field of ['quantity', 'unitPrice']) {
      if (item[field] !== undefined && (!Number.isFinite(Number(item[field])) || Number(item[field]) < 0)) {
        throw new Error(`Invoice item ${index + 1} has invalid ${field}`);
      }
    }
  });
  if (value.status && !['DRAFT', 'SAVED'].includes(value.status)) throw new Error('Invoice status must be DRAFT or SAVED');
  return value;
}

export function validateInvoicePatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invoice patch file must contain a JSON object');
  if ('id' in value) throw new Error('Invoice patch must not contain id; the CLI resolves it from --invoice');
  if (Object.keys(value).length === 0) throw new Error('Invoice patch must contain at least one field');
  if (value.items !== undefined) {
    if (!Array.isArray(value.items) || value.items.length === 0) throw new Error('Invoice patch items must contain at least one item');
    value.items.forEach((item, index) => {
      if (!item || typeof item.productId !== 'string' || !item.productId.trim()) throw new Error(`Invoice item ${index + 1} requires productId`);
    });
  }
  return value;
}

function requiredOption(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1 || !argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${name} is required`);
  return argv[index + 1];
}

function optionalOption(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function printDryRun(input, stdout, resource, verb = 'created') {
  stdout(`Dry run: no ${resource} was ${verb}. Add --submit to apply it.`);
  stdout(JSON.stringify(input, null, 2));
}

function printRows(rows, fields, stdout) {
  if (!rows.length) {
    stdout('No results.');
    return;
  }
  stdout(fields.join('\t'));
  for (const row of rows) stdout(fields.map((field) => row[field] ?? '').join('\t'));
}

export { HELP };
