import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run, validateInvoice } from '../src/cli.js';

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
