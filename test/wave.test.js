import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveClient } from '../src/wave.js';

test('sends token as bearer authorization without exposing it in errors', async () => {
  let request;
  const client = new WaveClient({
    token: 'secret-token',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ data: { businesses: { edges: [] } } }), { status: 200 });
    }
  });
  await client.businesses();
  assert.equal(request.options.headers.authorization, 'Bearer secret-token');
  assert.equal(JSON.parse(request.options.body).variables instanceof Object, true);
});

test('patches a product', async () => {
  let request;
  const client = new WaveClient({
    token: 'secret-token',
    fetchImpl: async (url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ data: { productPatch: { didSucceed: true, inputErrors: [], product: { id: 'p', name: 'New Name' } } } }), { status: 200 });
    }
  });
  const product = await client.patchProduct({ id: 'p', name: 'New Name' });
  assert.match(request.query, /productPatch/);
  assert.deepEqual(request.variables, { input: { id: 'p', name: 'New Name' } });
  assert.equal(product.name, 'New Name');
});

test('archives a product', async () => {
  let request;
  const client = new WaveClient({
    token: 'secret-token',
    fetchImpl: async (url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ data: { productArchive: { didSucceed: true, inputErrors: [], product: { id: 'p', name: 'Old Service', isArchived: true } } } }), { status: 200 });
    }
  });
  const product = await client.archiveProduct('p');
  assert.match(request.query, /productArchive/);
  assert.deepEqual(request.variables, { input: { id: 'p' } });
  assert.equal(product.isArchived, true);
});


test('creates an estimate using the documented mutation and preserves its input', async () => {
  let request;
  const estimate = { id: 'e', estimateNumber: 'QUOTE-1', status: 'DRAFT', viewUrl: 'https://example.com/quote' };
  const client = new WaveClient({ token: 'test-token', fetchImpl: async (url, options) => {
    request = JSON.parse(options.body);
    return new Response(JSON.stringify({ data: { estimateCreate: { didSucceed: true, estimate } } }));
  } });
  const input = { businessId: 'b', customerId: 'c', status: 'DRAFT', items: [{ productId: 'p', unitPrice: '175.00' }] };
  assert.deepEqual(await client.createEstimate(input), estimate);
  assert.match(request.query, /CreateEstimate\(\$input: EstimateCreateInput!\)/);
  assert.match(request.query, /estimateCreate\(input: \$input\)/);
  assert.deepEqual(request.variables, { input });
});

test('estimate creation reports Wave validation failures', async () => {
  const client = new WaveClient({ token: 'test-token', fetchImpl: async () => new Response(JSON.stringify({ data: { estimateCreate: { didSucceed: false, inputErrors: [{ path: ['input', 'customerId'], message: 'Customer not found' }] } } })) });
  await assert.rejects(client.createEstimate({}), /input.customerId: Customer not found/);
});


test('estimate update preserves items, taxes, number, memo, discounts, attachments and settings', async () => {
  const estimate = { id: 'e', status: 'DRAFT', estimateNumber: 'Q1', title: 'Quote', memo: 'Keep', disableBankPayments: true, customer: { id: 'c' }, currency: { code: 'USD' }, items: [{ product: { id: 'p', name: 'Service' }, description: 'Keep item', quantity: '23', unitPrice: '175', taxes: [{ salesTax: { id: 'tax' } }] }], attachments: [{ id: 'attachment' }], discounts: [{ __typename: 'FixedEstimateDiscount', name: 'Discount', amount: '10' }] };
  const client = new WaveClient({ token: 'test', fetchImpl: async () => new Response(JSON.stringify({ data: { business: { estimate } } })) });
  const input = await client.prepareEstimateUpdate('b', 'e', { subhead: '' });
  assert.equal(input.estimateNumber, 'Q1'); assert.equal(input.memo, 'Keep'); assert.equal(input.disableBankPayments, true); assert.equal(input.subhead, '');
  assert.deepEqual(input.items[0].taxes, [{ salesTaxId: 'tax' }]); assert.equal(input.items[0].quantity, '23');
  assert.deepEqual(input.attachmentIds, ['attachment']); assert.deepEqual(input.discounts, [{ name: 'Discount', discountType: 'FIXED', amount: '10' }]);
  estimate.status = 'SAVED';
  await assert.rejects(client.prepareEstimateUpdate('b', 'e', {}), /Only draft/);
});
