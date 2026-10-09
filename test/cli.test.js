import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run, validateInvoice, validateEstimate } from '../src/cli.js';

test('validates required invoice fields', () => {
  assert.throws(() => validateInvoice({ items: [] }), /businessId/);
  assert.throws(() => validateInvoice({ businessId: 'b', customerId: 'c', items: [] }), /at least one item/);
});

test('invoice creation defaults to a dry run', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'waveapps-cli-'));
  const file = join(directory, 'invoice.json');
  await writeFile(file, JSON.stringify({ businessId: 'b', customerId: 'c', items: [{ productId: 'p' }] }));
  const output = [];
  let submitted = false;
  await run(['invoices', 'create', '--file', file], {
    env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' },
    stdout: (line) => output.push(line),
    clientFactory: () => ({ createInvoice: async () => { submitted = true; } })
  });
  assert.equal(submitted, false);
  assert.match(output[0], /Dry run/);
});

test('--submit calls invoiceCreate', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'waveapps-cli-'));
  const file = join(directory, 'invoice.json');
  await writeFile(file, JSON.stringify({ businessId: 'b', customerId: 'c', items: [{ productId: 'p' }] }));
  let received;
  await run(['invoices', 'create', '--file', file, '--submit'], {
    env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' },
    stdout: () => {},
    clientFactory: () => ({ createInvoice: async (input) => { received = input; return { id: 'i', invoiceNumber: '7', status: 'DRAFT' }; } })
  });
  assert.equal(received.customerId, 'c');
});

test('customer creation previews, then submits explicitly', async () => {
  let received;
  const clientFactory = () => ({
    createCustomer: async (input) => { received = input; return { id: 'customer-id', name: input.name }; }
  });
  await run(['customers', 'create', '--business', 'b', '--name', 'Jane Example'], {
    env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory
  });
  assert.equal(received, undefined);
  await run(['customers', 'create', '--business', 'b', '--name', 'Jane Example', '--submit'], {
    env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory
  });
  assert.deepEqual(received, { businessId: 'b', name: 'Jane Example' });
});

test('product creation submits a sellable product', async () => {
  let received;
  await run(['products', 'create', '--business', 'b', '--name', 'Support', '--price', '80.00', '--income-account', 'a', '--submit'], {
    env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' },
    stdout: () => {},
    clientFactory: () => ({ createProduct: async (input) => { received = input; return { id: 'p', name: input.name }; } })
  });
  assert.deepEqual(received, { businessId: 'b', name: 'Support', unitPrice: '80.00', incomeAccountId: 'a' });
});

test('product rename previews, then submits explicitly', async () => {
  let received;
  const clientFactory = () => ({
    patchProduct: async (input) => { received = input; return { id: input.id, name: input.name }; }
  });
  const args = ['products', 'rename', '--product', 'p', '--name', 'Generic Service'];
  await run(args, { env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory });
  assert.equal(received, undefined);
  await run([...args, '--submit'], { env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory });
  assert.deepEqual(received, { id: 'p', name: 'Generic Service' });
});

test('product delete previews, then archives explicitly', async () => {
  let received;
  const clientFactory = () => ({
    archiveProduct: async (id) => { received = id; return { id, name: 'Old Service', isArchived: true }; }
  });
  const args = ['products', 'delete', '--product', 'p'];
  const output = [];
  await run(args, { env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: (line) => output.push(line), clientFactory });
  assert.equal(received, undefined);
  assert.match(output.join('\n'), /Archive the product in Wave/);
  await run([...args, '--submit'], { env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory });
  assert.equal(received, 'p');
});

test('invoice number update previews, then submits explicitly', async () => {
  let received;
  const clientFactory = () => ({
    invoiceByNumber: async () => ({ id: 'invoice-id', invoiceNumber: 'OLD-1', customer: { name: 'Jane Example' } }),
    setInvoiceNumber: async (id, invoiceNumber) => { received = { id, invoiceNumber }; return { id, invoiceNumber }; }
  });
  const args = ['invoices', 'set-number', '--business', 'b', '--invoice', 'OLD-1', '--number', 'NEW-1'];
  await run(args, { env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory });
  assert.equal(received, undefined);
  await run([...args, '--submit'], { env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory });
  assert.deepEqual(received, { id: 'invoice-id', invoiceNumber: 'NEW-1' });
});

test('invoice file update previews, then submits the resolved invoice explicitly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'waveapps-cli-'));
  const file = join(directory, 'patch.json');
  await writeFile(file, JSON.stringify({ memo: 'Updated memo' }));
  let received;
  const clientFactory = () => ({
    invoiceByNumber: async () => ({ id: 'invoice-id', invoiceNumber: 'INV-1', customer: { name: 'Jane Example' } }),
    patchInvoice: async (input) => { received = input; return { invoiceNumber: 'INV-1' }; }
  });
  const args = ['invoices', 'update', '--business', 'b', '--invoice', 'INV-1', '--file', file];
  await run(args, { env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory });
  assert.equal(received, undefined);
  await run([...args, '--submit'], { env: { WAVEAPPS_FULL_ACCESS_TOKEN: 'test-token' }, stdout: () => {}, clientFactory });
  assert.deepEqual(received, { id: 'invoice-id', memo: 'Updated memo' });
});


test('estimate validation defaults to DRAFT and rejects invalid required values', () => {
  const valid = { businessId: 'b', customerId: 'c', items: [{ productId: 'p', unitPrice: '175.00', quantity: '65' }] };
  assert.equal(validateEstimate(valid).status, 'DRAFT');
  assert.equal(valid.status, undefined);
  for (const value of [null, [], {}, { ...valid, customerId: '' }, { ...valid, items: [] }, { ...valid, items: [null] }, { ...valid, status: 'SAVED' }]) {
    assert.throws(() => validateEstimate(value), /Estimate/);
  }
  for (const amount of [undefined, null, '', ' ', true, [], {}, '-1', 'Infinity', '1e3', 'NaN']) {
    assert.throws(() => validateEstimate({ ...valid, items: [{ productId: 'p', unitPrice: amount }] }), /unitPrice/);
  }
  assert.throws(() => validateEstimate({ ...valid, items: [{ productId: 'p', unitPrice: '175', quantity: null }] }), /quantity/);
  assert.equal(validateEstimate({ ...valid, items: [{ productId: 'p', unitPrice: 0 }] }).items[0].unitPrice, 0);
});

test('estimate creation previews without mutation and submits only with --submit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'waveapps-cli-'));
  const file = join(directory, 'estimate.json');
  const input = { businessId: 'b', customerId: 'c', estimateDate: '2026-10-09', dueDate: '2026-11-08', estimateNumber: 'QUOTE-1', title: 'Consulting Quote', memo: 'Bill actual hours.', items: [{ productId: 'p', quantity: '65', unitPrice: '175.00' }] };
  await writeFile(file, JSON.stringify(input));
  let received;
  const output = [];
  const options = { env: {}, stdout: (line) => output.push(line), clientFactory: () => ({ createEstimate: async (value) => { received = value; return { id: 'e', estimateNumber: 'QUOTE-1', status: 'DRAFT', viewUrl: 'https://example.com/quote' }; } }) };
  const args = ['estimates', 'create', '--file', file];
  await run(args, options);
  assert.equal(received, undefined);
  assert.match(output[0], /Dry run: no estimate/);
  assert.deepEqual(JSON.parse(output[1]), { ...input, status: 'DRAFT' });
  await run([...args, '--submit'], options);
  assert.deepEqual(received, { ...input, status: 'DRAFT' });
  assert.ok(output.includes('Created estimate QUOTE-1 (DRAFT)'));
  assert.ok(output.includes('https://example.com/quote'));
});


test('estimate validity defaults to 30 calendar days and respects explicit dates', () => {
  const input = { businessId: 'b', customerId: 'c', estimateDate: '2026-12-20', items: [{ productId: 'p', unitPrice: '1' }] };
  assert.equal(validateEstimate(input).dueDate, '2027-01-19');
  assert.equal(validateEstimate({ ...input, dueDate: '2026-12-31' }).dueDate, '2026-12-31');
  assert.throws(() => validateEstimate({ ...input, estimateDate: '2026-02-30' }), /valid YYYY-MM-DD/);
});

test('estimate updates fetch a complete preview and submit only explicitly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'waveapps-cli-'));
  const file = join(dir, 'patch.json');
  await writeFile(file, JSON.stringify({ subhead: '', dueDate: '2026-11-08' }));
  let submitted;
  const full = { id: 'e', estimateNumber: 'QUOTE-1', items: [{ quantity: '23' }], memo: 'Preserved', subhead: '', dueDate: '2026-11-08' };
  const clientFactory = () => ({ prepareEstimateUpdate: async (b, e, patch) => { assert.equal(b, 'b'); assert.equal(e, 'e'); assert.equal(patch.subhead, ''); return full; }, updateEstimate: async input => { submitted = input; return { estimateNumber: 'QUOTE-1', status: 'DRAFT' }; } });
  const args = ['estimates', 'update', '--business', 'b', '--estimate', 'e', '--file', file];
  await run(args, { clientFactory, stdout: () => {} });
  assert.equal(submitted, undefined);
  await run([...args, '--submit'], { clientFactory, stdout: () => {} });
  assert.deepEqual(submitted, full);
});
