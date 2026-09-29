import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

// This submits one real agent workflow and can incur model charges, including child retries.
const base = process.env.DEMO_BASE_URL;
const token = process.env.DEMO_TEST_TOKEN;
if (!base || !token) throw new Error('Set DEMO_BASE_URL and DEMO_TEST_TOKEN');
const runId = z
  .string()
  .uuid()
  .parse(process.env.DEMO_AGENT_RUN_ID ?? randomUUID());
const draft =
  'Our museum was opened in 1998. Every Friday at 3 p.m., our museum has a free repair clinic. ' +
  'The clinic is free. Tickets are not required. People who want to visit can just come. ' +
  'This paragraph has a lot of words that are not needed.';
const criteria =
  'Make a concise visitor announcement. Preserve the opening year 1998, Friday at 3 p.m., ' +
  'the free repair clinic and no-ticket requirement. Remove repetition and commentary about the writing. ' +
  'Each review should give one or two sentences of actionable feedback.';

/** Call the hosted real-agent example with the authorized tester token. */
async function request(path: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(90000),
  });
  return { status: response.status, body: (await response.json()) as unknown };
}
/** Retrieve the synthetic agent run binding for native lineage verification. */
function record(value: unknown) {
  if (process.env.DEMO_RESULTS_FILE) writeFileSync(process.env.DEMO_RESULTS_FILE, JSON.stringify(value, null, 2));
  console.log(JSON.stringify(value));
}
const config = await request('/api/config');
assert.equal(config.status, 200);
z.object({ mode: z.literal('agent') }).parse(config.body);
// Save the identity before submitting. Reuse DEMO_AGENT_RUN_ID after an interrupted test.
record({ check: 'real-agent submission', runId, draft, criteria, status: 'prepared' });
const accepted = await request('/api/jobs', { runId, draft, criteria });
assert.equal(accepted.status, 202, JSON.stringify(accepted));
assert.equal(z.object({ runId: z.string() }).parse(accepted.body).runId, runId);
record({ check: 'real-agent acceptance', runId, draft, criteria, status: 'accepted' });

const deadline = performance.now() + 600000;
let completed: unknown;
let previousStatus: string | undefined;
while (performance.now() < deadline) {
  const reply = await request(`/api/jobs/${runId}`);
  assert.equal(reply.status, 200, JSON.stringify(reply));
  const status = z.object({ status: z.string() }).parse(reply.body).status;
  if (status !== previousStatus) {
    console.log(JSON.stringify({ runId, status }));
    previousStatus = status;
  }
  if (['success', 'failed', 'canceled'].includes(status)) {
    completed = reply.body;
    break;
  }
  await delay(3000);
}
assert.ok(completed, `Timed out; reconnect to ${runId} before submitting another job`);
record({ check: 'real-agent terminal response', runId, response: completed });
const result = z
  .object({
    status: z.literal('success'),
    result: z.object({
      result: z.object({
        mode: z.literal('agent'),
        revisedDraft: z.string().min(1),
        findings: z.array(z.object({ focus: z.string().min(1), feedback: z.string().min(1) })).length(3),
      }),
    }),
  })
  .parse(completed).result.result;
assert.notEqual(result.revisedDraft, draft, 'The editor must perform a real revision');
assert.match(result.revisedDraft, /1998/);
assert.match(result.revisedDraft, /Friday/i);
assert.match(result.revisedDraft, /(?:3(?::00)?\s*p\.?\s*m\.?|15:00)/i);
assert.match(result.revisedDraft, /free/i);
assert.match(result.revisedDraft, /repair clinic/i);
assert.ok(result.findings.every(finding => !finding.feedback.startsWith('Deterministic check:')));
record({ check: 'real Mastra reviewers and editor', passed: true, runId, draft, criteria, result });
