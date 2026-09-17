import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createDependencies, type FoundationDependencies } from '../src/create-dependencies.js';
import { fixtureApplication, getFixtureScenario } from '../src/fixtures/provider-scenarios.js';
import { createServer } from '../src/server/create-server.js';
import { signWebhook } from '../src/server/webhook-signing.js';
import { createTestConfig } from './helpers/test-config.js';

const directories: string[] = [];
const activeDependencies: FoundationDependencies[] = [];

afterEach(async () => {
  for (const dependencies of activeDependencies.splice(0)) dependencies.storage.close();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

const createApp = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-kyc-intake-api-'));
  directories.push(directory);
  const dependencies = await createDependencies(createTestConfig(directory));
  activeDependencies.push(dependencies);
  const app = await createServer(dependencies);
  const login = await app.request('/api/v1/demo/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
    body: JSON.stringify({ persona: 'applicant' }),
  });
  const session = (await login.json()) as { csrfToken: string };
  const cookie = login.headers.get('Set-Cookie')?.split(';', 1)[0];
  if (cookie === undefined) throw new Error('Demo session cookie was not created');
  const commandHeaders = {
    Cookie: cookie,
    Origin: 'http://127.0.0.1:5173',
    'X-CSRF-Token': session.csrfToken,
  };
  return { app, dependencies, commandHeaders };
};

describe('application intake API', () => {
  it('creates an idempotent case and stores a synthetic upload by opaque reference', async () => {
    const { app, dependencies, commandHeaders } = await createApp();
    const caseRequest = () =>
      app.request('/api/v1/kyc/cases', {
        method: 'POST',
        headers: {
          ...commandHeaders,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'api-case-001',
        },
        body: JSON.stringify({ application: fixtureApplication }),
      });

    const firstCase = await caseRequest();
    const replayedCase = await caseRequest();
    expect(firstCase.status).toBe(201);
    expect(replayedCase.status).toBe(201);
    const firstCaseBody = (await firstCase.json()) as { caseId: string; status: string };
    await expect(replayedCase.json()).resolves.toEqual(firstCaseBody);

    const fixture = getFixtureScenario('low-risk');
    const form = new FormData();
    form.set('file', new File([fixture.bytes], 'untrusted-name.pdf', { type: fixture.mimeType }));
    form.set('documentType', fixture.documentType);
    form.set('side', 'SINGLE');
    const upload = await app.request(`/api/v1/kyc/cases/${firstCaseBody.caseId}/documents`, {
      method: 'POST',
      headers: { ...commandHeaders, 'Idempotency-Key': 'api-document-001' },
      body: form,
    });

    expect(upload.status).toBe(201);
    const uploadBody = await upload.json();
    expect(uploadBody).toMatchObject({
      caseId: firstCaseBody.caseId,
      status: 'EXTRACTING',
      mimeType: 'application/pdf',
      pageCount: 1,
    });
    expect(JSON.stringify(uploadBody)).not.toMatch(/storageKey|untrusted-name|Morgan|SYNTHETIC/u);

    const readyAfterReload = await app.request(`/api/v1/kyc/cases/${firstCaseBody.caseId}`, {
      headers: { Cookie: commandHeaders.Cookie },
    });
    expect(readyAfterReload.status).toBe(200);
    await expect(readyAfterReload.json()).resolves.toMatchObject({
      status: 'EXTRACTING',
      workflowStatus: 'NOT_STARTED',
      documentReadiness: { storedDocumentCount: 1, canStart: true },
    });

    const started = await app.request(`/api/v1/kyc/cases/${firstCaseBody.caseId}/start`, {
      method: 'POST',
      headers: { ...commandHeaders, 'Idempotency-Key': 'api-start-001' },
    });
    expect(started.status).toBe(202);
    await expect(started.json()).resolves.toMatchObject({
      schemaVersion: '1.0',
      caseId: firstCaseBody.caseId,
      status: 'COMPLIANCE_REVIEW',
      workflowStatus: 'SUSPENDED',
      pendingAction: { type: 'COMPLIANCE_REVIEW', level: 'INITIAL' },
    });

    const status = await app.request(`/api/v1/kyc/cases/${firstCaseBody.caseId}`, {
      headers: { Cookie: commandHeaders.Cookie },
    });
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({ status: 'COMPLIANCE_REVIEW' });

    const events = await app.request(`/api/v1/kyc/cases/${firstCaseBody.caseId}/events?limit=100`, {
      headers: { Cookie: commandHeaders.Cookie },
    });
    expect(events.status).toBe(200);
    const eventsBody = (await events.json()) as {
      schemaVersion: string;
      terminal: boolean;
      events: { eventId: string }[];
    };
    expect(eventsBody).toMatchObject({ schemaVersion: '1.0', terminal: false });
    expect(JSON.stringify(eventsBody)).not.toMatch(/Morgan|SYNTHETIC|actor|evidence/u);

    const invalidCursor = await app.request(
      `/api/v1/kyc/cases/${firstCaseBody.caseId}/events?cursor=event-that-does-not-exist`,
      { headers: { Cookie: commandHeaders.Cookie } },
    );
    expect(invalidCursor.status).toBe(400);
    await expect(invalidCursor.json()).resolves.toMatchObject({ code: 'INVALID_CURSOR' });

    const headerPrecedence = await app.request(
      `/api/v1/kyc/cases/${firstCaseBody.caseId}/events?cursor=${eventsBody.events[0]?.eventId ?? ''}`,
      {
        headers: {
          Cookie: commandHeaders.Cookie,
          Accept: 'text/event-stream',
          'Last-Event-ID': 'event-that-does-not-exist',
        },
      },
    );
    expect(headerPrecedence.status).toBe(400);
    await expect(headerPrecedence.json()).resolves.toMatchObject({ code: 'INVALID_CURSOR' });

    const reviewerLogin = await app.request('/api/v1/demo/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
      body: JSON.stringify({ persona: 'reviewer' }),
    });
    await reviewerLogin.json();
    const reviewerCookie = reviewerLogin.headers.get('Set-Cookie')?.split(';', 1)[0];
    if (reviewerCookie === undefined) throw new Error('Reviewer session cookie was not created');
    const queue = await app.request('/api/v1/reviews?limit=25', {
      headers: { Cookie: reviewerCookie },
    });
    expect(queue.status).toBe(200);
    const queueBody = (await queue.json()) as {
      reviews: { reviewId: string; caseId: string }[];
    };
    expect(queueBody.reviews).toHaveLength(1);
    expect(queueBody.reviews[0]).toMatchObject({ caseId: firstCaseBody.caseId });
    const reviewId = queueBody.reviews[0]?.reviewId;
    if (reviewId === undefined) throw new Error('Review was not returned');
    const signedDecision = signWebhook({
      key: dependencies.webhooks.complianceDecision.reviewer.current,
      timestamp: String(Math.floor(Date.now() / 1_000)),
      deliveryId: 'api-review-delivery-001',
      idempotencyKey: 'api-review-approve-001',
      body: {
        schemaVersion: '1.0',
        reviewId,
        decision: 'APPROVE',
        reasonCode: 'REVIEW_APPROVED',
      },
    });
    const wrongAuthority = signWebhook({
      key: dependencies.webhooks.complianceDecision.seniorReviewer.current,
      timestamp: String(Math.floor(Date.now() / 1_000)),
      deliveryId: 'api-review-delivery-wrong-role',
      idempotencyKey: 'api-review-wrong-role-001',
      body: {
        schemaVersion: '1.0',
        reviewId,
        decision: 'APPROVE',
        reasonCode: 'REVIEW_APPROVED',
      },
    });
    const forbidden = await app.request('/api/v1/webhooks/compliance-decision', {
      method: 'POST',
      headers: wrongAuthority.headers,
      body: wrongAuthority.body,
    });
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toMatchObject({ code: 'WEBHOOK_ROLE_FORBIDDEN' });
    const decide = () =>
      app.request('/api/v1/webhooks/compliance-decision', {
        method: 'POST',
        headers: signedDecision.headers,
        body: signedDecision.body,
      });
    const decision = await decide();
    expect(decision.status).toBe(200);
    await expect(decision.json()).resolves.toMatchObject({
      status: 'ACTIVE',
      workflowStatus: 'COMPLETED',
      pendingAction: null,
    });
    const replayedDecision = await decide();
    expect(replayedDecision.status).toBe(200);
    await expect(replayedDecision.json()).resolves.toMatchObject({ status: 'ACTIVE' });

    const firstEventId = eventsBody.events[0]?.eventId;
    if (firstEventId === undefined) throw new Error('Case creation event was not returned');
    const stream = await app.request(`/api/v1/kyc/cases/${firstCaseBody.caseId}/events`, {
      headers: {
        Cookie: commandHeaders.Cookie,
        Accept: 'text/event-stream',
        'Last-Event-ID': firstEventId,
      },
    });
    expect(stream.status).toBe(200);
    expect(stream.headers.get('Content-Type')).toContain('text/event-stream');
    const streamBody = await stream.text();
    expect(streamBody).toContain('retry: 2000');
    expect(streamBody).toContain('event: case-event');
    expect(streamBody).toContain('event: terminal');
    expect(streamBody).not.toContain(`id: ${firstEventId}\n`);
    expect(streamBody).not.toMatch(/Morgan|SYNTHETIC|actor|evidence/u);

    const metrics = await app.request('/api/v1/metrics/summary', {
      headers: { Cookie: reviewerCookie },
    });
    expect(metrics.status).toBe(200);
    await expect(metrics.json()).resolves.toMatchObject({
      schemaVersion: '1.1',
      sampleCount: 1,
      denominator: 1,
      finalStatusCounts: {
        active: 1,
        rejected: 0,
        escalated: 0,
        provisioningFailed: 0,
      },
      rates: {
        approval: 'not_available',
        rejection: 'not_available',
        escalation: 'not_available',
        missingInformation: 'not_available',
      },
      projectionLag: { pendingEvents: 0, oldestPendingAt: null },
    });
    const applicantMetrics = await app.request('/api/v1/metrics/summary', {
      headers: { Cookie: commandHeaders.Cookie },
    });
    expect(applicantMetrics.status).toBe(403);

    const beforeReplay = await dependencies.storage.analytics.connect();
    const projectedRowsBefore = await beforeReplay.runAndReadAll(
      "SELECT count(*) AS count FROM kyc_case_events WHERE tenant_id = 'demo'",
    );
    const projectedCount = Number(projectedRowsBefore.getRowObjectsJS()[0]?.count);
    beforeReplay.closeSync();
    await dependencies.storage.operational.execute(
      `UPDATE analytics_outbox SET projected_at = NULL
       WHERE tenant_id = 'demo' AND event_id = (
         SELECT event_id FROM analytics_outbox WHERE tenant_id = 'demo' ORDER BY created_at,event_id LIMIT 1
       )`,
    );
    await expect(dependencies.services.metrics.projectPending('demo')).resolves.toBe(1);
    const afterReplay = await dependencies.storage.analytics.connect();
    const projectedRowsAfter = await afterReplay.runAndReadAll(
      "SELECT count(*) AS count FROM kyc_case_events WHERE tenant_id = 'demo'",
    );
    expect(Number(projectedRowsAfter.getRowObjectsJS()[0]?.count)).toBe(projectedCount);
    afterReplay.closeSync();

    const persisted = await dependencies.storage.operational.execute(
      'SELECT payload_json FROM documents WHERE tenant_id = ?',
      ['demo'],
    );
    expect(z.string().parse(persisted.rows[0]?.payload_json)).not.toContain('untrusted-name.pdf');
  });

  it('fails safely for missing idempotency and spoofed document MIME', async () => {
    const { app, commandHeaders } = await createApp();
    const missingKey = await app.request('/api/v1/kyc/cases', {
      method: 'POST',
      headers: { ...commandHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ application: fixtureApplication }),
    });
    expect(missingKey.status).toBe(400);
    await expect(missingKey.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'The request is invalid',
    });

    const created = await app.request('/api/v1/kyc/cases', {
      method: 'POST',
      headers: {
        ...commandHeaders,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'api-case-002',
      },
      body: JSON.stringify({ application: fixtureApplication }),
    });
    const { caseId } = (await created.json()) as { caseId: string };
    const form = new FormData();
    form.set('file', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'spoof.png', { type: 'image/png' }));
    form.set('documentType', 'PASSPORT');
    form.set('side', 'SINGLE');
    const spoofed = await app.request(`/api/v1/kyc/cases/${caseId}/documents`, {
      method: 'POST',
      headers: { ...commandHeaders, 'Idempotency-Key': 'api-document-002' },
      body: form,
    });
    expect(spoofed.status).toBe(400);
    await expect(spoofed.json()).resolves.toMatchObject({ code: 'DOCUMENT_MIME_MISMATCH' });

    const truncatedUploads = [
      ['image/jpeg', new Uint8Array([0xff, 0xd8, 0xff])],
      ['image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      ['application/pdf', new TextEncoder().encode('%PDF-1.4\n/Type /Page\nxref\ntrailer\n%%EOF')],
    ] as const;
    for (const [index, [mimeType, bytes]] of truncatedUploads.entries()) {
      const truncatedForm = new FormData();
      truncatedForm.set('file', new File([bytes], `truncated-${String(index)}`, { type: mimeType }));
      truncatedForm.set('documentType', 'PASSPORT');
      truncatedForm.set('side', 'SINGLE');
      const response = await app.request(`/api/v1/kyc/cases/${caseId}/documents`, {
        method: 'POST',
        headers: { ...commandHeaders, 'Idempotency-Key': `api-truncated-${String(index)}` },
        body: truncatedForm,
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: mimeType === 'application/pdf' ? 'DOCUMENT_PDF_INVALID' : 'DOCUMENT_CONTENT_INVALID',
      });
    }
  });

  it('limits concurrent SSE streams per demo session and releases them on abort', async () => {
    const { app, commandHeaders } = await createApp();
    const created = await app.request('/api/v1/kyc/cases', {
      method: 'POST',
      headers: {
        ...commandHeaders,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'api-sse-limit-case-001',
      },
      body: JSON.stringify({ application: fixtureApplication }),
    });
    const { caseId } = (await created.json()) as { caseId: string };
    const controllers = Array.from({ length: 5 }, () => new AbortController());
    const streams: Response[] = [];
    for (const controller of controllers) {
      streams.push(
        await Promise.resolve(
          app.request(`/api/v1/kyc/cases/${caseId}/events`, {
            headers: { Cookie: commandHeaders.Cookie, Accept: 'text/event-stream' },
            signal: controller.signal,
          }),
        ),
      );
    }
    expect(streams.map(stream => stream.status)).toEqual([200, 200, 200, 200, 200]);

    const limited = await app.request(`/api/v1/kyc/cases/${caseId}/events`, {
      headers: { Cookie: commandHeaders.Cookie, Accept: 'text/event-stream' },
    });
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ code: 'SSE_CONNECTION_LIMIT' });

    for (const controller of controllers) controller.abort();
    for (const stream of streams) await stream.body?.cancel();
  });
});
