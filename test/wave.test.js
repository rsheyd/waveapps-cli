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
