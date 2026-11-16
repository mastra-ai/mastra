import assert from 'node:assert/strict';
import { lossyProxy } from '../support/lossy-proxy.js';
import { randomUUID } from 'node:crypto';
import { Autumn } from 'autumn-js';
import { it } from 'vitest';
import { AutumnBillingProvider } from '../../src/billing/providers/autumn/index.js';
import type { ReservationRequest } from '../../src/billing/contracts/reservations.js';
import { temporaryDatabase } from '../support/billing.js';

// This gate consumes at most two sandbox credits; it never refunds, purchases,
// creates customers or invokes an image/model. Missing opt-in is a failure.
async function proveSandbox(scenario: 'lifecycle' | 'recovery') {
  assert.equal(process.env.AUTUMN_VERIFY_SANDBOX, '1', 'Run scripts/test-autumn-sandbox.mjs --live explicitly.');
  const secretKey = process.env.AUTUMN_SECRET_KEY!;
  const customerId = process.env.AUTUMN_TEST_CUSTOMER_ID!;
  const featureId = process.env.AUTUMN_TEST_FEATURE_ID!;
  const creditPoolId = process.env.AUTUMN_TEST_CREDIT_POOL_ID ?? 'image_credits';
  assert.equal(customerId, 'johns-org');
  assert.equal(featureId, 'generated_images');
  const client = new Autumn({
    secretKey,
    failOpen: false,
    retryConfig: { strategy: 'none' },
    useEdge: false,
    xApiVersion: '2.6.0',
    timeoutMs: 10000,
  });
  // Existing sandbox customer is checked read-only before any provider mutation.
  const customer = await client.customers.get({ customerId });
  assert.equal(customer.id, customerId);
  assert.equal(customer.env, 'sandbox');
  const database = await temporaryDatabase();
  const bindings = {
    customers: [{ workspaceId: 'johns-org-sandbox-proof', customerId, name: "John's Org" }],
    meters: [{ key: 'credits', featureId, creditPoolId }],
  };
  const provider = await AutumnBillingProvider.open({ url: database.url }, { secretKey, bindings });
  const active: { request: ReservationRequest; payload: string }[] = [];
  const balances: { label: string; remaining: number }[] = [];
  const account = await provider.ensureAccount({ workspaceId: 'johns-org-sandbox-proof' });
  const read = async (label: string) => {
    const snapshot = await provider.getState(account);
    assert.equal(snapshot.prepaidAuthority, 'provider-reservations');
    assert.equal(snapshot.meters[0].key, 'credits');
    const remaining = snapshot.meters[0].confirmedBalance!;
    assert.equal(snapshot.meters[0].consumedUnits, null);
    balances.push({ label, remaining });
    return remaining;
  };
  const reserve = async (units: number, lifetime = 60000) => {
    const now = Date.now();
    const request: ReservationRequest = {
      id: `johns-org-proof:${randomUUID()}`,
      account,
      meter: 'credits',
      units,
      executionCutoff: now + Math.floor(lifetime / 3),
      confirmationCutoff: now + Math.floor((2 * lifetime) / 3),
      expiresAt: now + lifetime,
    };
    const payload = provider.reservations.prepareReservation(request);
    const result = await provider.reservations.reserve(payload);
    if (result.status === 'reserved') active.push({ request, payload });
    return { request, payload, result };
  };
  const finalize = async (
    value: { request: ReservationRequest; payload: string },
    action: 'confirm' | 'release',
    units: number,
  ) => {
    const payload = provider.reservations.prepareFinalization(
      { reservation: value.request, action, units },
      value.payload,
    );
    // Claim the terminal action before dispatch. An unknown acknowledgement
    // must never cause cleanup to send an opposite or repeated mutation.
    const index = active.findIndex(item => item.request.id === value.request.id);
    if (index >= 0) active.splice(index, 1);
    const result = await provider.reservations.finalize(payload);
    return { payload, result };
  };
  try {
    const opening = await read('opening');
    assert.ok(Number.isSafeInteger(opening) && opening >= 6, 'At least six available test credits are required.');
    if (scenario === 'lifecycle') {
      const original = await reserve(3);
      assert.equal(original.result.status, 'reserved');
      assert.equal(await read('reserved'), opening - 3);
      // The actual API rejects duplicates rather than certifying current ownership.
      assert.equal((await provider.reservations.reserve(original.payload)).status, 'uncertain');
      assert.equal(
        (
          await provider.reservations.reserve(
            provider.reservations.prepareReservation({ ...original.request, units: 4 }),
          )
        ).status,
        'uncertain',
      );
      const partial = await finalize(original, 'confirm', 1);
      assert.equal(partial.result.status, 'confirmed');
      assert.equal(await read('partial confirmation'), opening - 1);
      assert.equal((await provider.reservations.finalize(partial.payload)).status, 'uncertain');
      assert.equal((await finalize(original, 'release', 0)).result.status, 'uncertain');
      assert.equal(await read('duplicate terminal requests'), opening - 1);

      console.log(
        JSON.stringify({
          provider: 'autumn',
          sdk: 'autumn-js@1.5.72',
          api: '2.6.0',
          scenario,
          opening,
          closing: opening - 1,
          consumedTestCredits: 1,
        }),
      );
      return {
        customerId,
        workspaceId: account.workspaceId,
        featureId,
        creditPoolId,
        meter: 'credits',
        opening,
        reserved: opening - 3,
        closing: await read('documented personal configuration'),
        confirmedUnits: 1,
      };
    }
    const budget = await reserve(opening - 1);
    assert.equal(budget.result.status, 'reserved');
    const race = await Promise.all([reserve(1), reserve(1)]);
    assert.equal(race.filter(value => value.result.status === 'reserved').length, 1);
    assert.equal(race.filter(value => value.result.status === 'denied').length, 1);
    const winner = race.find(value => value.result.status === 'reserved')!;
    assert.equal((await provider.reservations.reserve(winner.payload)).status, 'uncertain');
    for (const value of [budget, winner]) assert.equal((await finalize(value, 'release', 0)).result.status, 'released');
    assert.equal((await finalize(winner, 'release', 0)).result.status, 'uncertain');
    assert.equal(await read('released race holds'), opening);

    const expiring = await reserve(2, 6000);
    assert.equal(expiring.result.status, 'reserved');
    const deadline = Date.now() + 90000;
    let remaining = await read('expiring hold');
    while (remaining !== opening && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      remaining = await read('eventual expiry');
    }
    assert.equal(remaining, opening, 'Eventual remote expiry must be observed rather than inferred from a clock.');
    active.splice(
      active.findIndex(item => item.request.id === expiring.request.id),
      1,
    );

    // An actual socket forwards to Autumn, applies confirm and drops only its
    // acknowledgement. Positive exact provider logs recover the same intent.
    const pending = await reserve(1);
    assert.equal(pending.result.status, 'reserved');
    let forwarded = 0;
    const proxy = await lossyProxy(async req => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      forwarded++;
      const remote = await fetch(`https://api.useautumn.com${req.url}`, {
        method: req.method,
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', 'x-api-version': '2.6.0' },
        body: Buffer.concat(chunks),
        signal: AbortSignal.timeout(10000),
      });
      await remote.arrayBuffer();
    });
    const lossy = await AutumnBillingProvider.open(
      { url: database.url },
      { secretKey, bindings, serverURL: proxy.url, timeoutMs: 10000 },
    );
    const payload = provider.reservations.prepareFinalization(
      { reservation: pending.request, action: 'confirm', units: 1 },
      pending.payload,
    );
    // Never release a possibly confirmed intent in cleanup, even if dispatch assertions fail.
    active.splice(
      active.findIndex(item => item.request.id === pending.request.id),
      1,
    );
    try {
      assert.equal((await lossy.reservations.finalize(payload)).status, 'uncertain');
      assert.equal(forwarded, 1);
      await proxy.completed();
    } finally {
      lossy.close();
      await proxy.close();
    }
    const evidenceDeadline = Date.now() + 120000;
    let recovered = await provider.reservations.reconcileFinalization(payload);
    while (recovered.status === 'uncertain' && Date.now() < evidenceDeadline) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      recovered = await provider.reservations.reconcileFinalization(payload);
    }
    assert.equal(recovered.status, 'confirmed', 'Absent or expired logs are unverified, not a passing recovery proof.');
    assert.equal(await read('final'), opening - 1);
    console.log(
      JSON.stringify({
        provider: 'autumn',
        sdk: 'autumn-js@1.5.72',
        api: '2.6.0',
        customerId,
        featureId,
        creditPoolId,
        opening,
        closing: opening - 1,
        consumedTestCredits: 1,
        observations: balances,
      }),
    );
  } finally {
    for (const value of [...active]) await finalize(value, 'release', 0);
    provider.close();
    await database.cleanup();
  }
}
// Both named proofs share one consuming lifecycle, including failures. Selecting
// either proof runs the actual driver; the full file still consumes at most two credits.
let lifecycle: ReturnType<typeof proveSandbox> | undefined;
const documentedLifecycle = () => (lifecycle ??= proveSandbox('lifecycle'));
it('Autumn sandbox proves atomic reserve confirm release and feature conversion', async () => {
  await documentedLifecycle();
}, 360000);
it('Autumn duplicate locks finalization and expiry preserve one charge', () => proveSandbox('recovery'), 360000);

it('Autumn sandbox proves the documented personal customer billing configuration', async () => {
  const proof = await documentedLifecycle();
  assert.ok(proof);
  assert.equal(proof.customerId, 'johns-org');
  assert.equal(proof.workspaceId, 'johns-org-sandbox-proof');
  assert.equal(proof.meter, 'credits');
  assert.equal(proof.featureId, 'generated_images');
  assert.equal(proof.creditPoolId, process.env.AUTUMN_TEST_CREDIT_POOL_ID ?? 'image_credits');
  assert.equal(proof.reserved, proof.opening - 3);
  assert.equal(proof.closing, proof.opening - 1);
  assert.equal(proof.confirmedUnits, 1);
}, 360000);
