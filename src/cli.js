import { readFile } from 'node:fs/promises';
import { WaveClient } from './wave.js';

const HELP = `waveapps - create Wave invoices from the terminal

Usage:
  waveapps businesses
  waveapps customers --business BUSINESS_ID
  waveapps customers create --business ID --name NAME [--email EMAIL] [--currency USD] [--submit]
  waveapps products --business BUSINESS_ID
  waveapps products create --business ID --name NAME --price PRICE --income-account ID [--description TEXT] [--submit]
  waveapps accounts --business BUSINESS_ID
  waveapps invoices create --file invoice.json [--submit]
  waveapps invoices update --business ID --invoice NUMBER --file patch.json [--submit]
  waveapps invoices set-number --business ID --invoice CURRENT --number NEW [--submit]
  waveapps help

All create and update commands are dry runs unless --submit is present.
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
