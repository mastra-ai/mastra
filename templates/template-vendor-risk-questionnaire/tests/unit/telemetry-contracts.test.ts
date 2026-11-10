import { expect, it } from 'vitest';
import { domainEventSchema } from '../../src/mastra/contracts/telemetry.ts';

const at = '2026-10-13T12:00:00.000Z';
it.each([
  { kind: 'reviewed', at },
  { kind: 'first_route', at, route: 'auto_draft' },
  { kind: 'first_route', at, questionId: 'q1' },
  { kind: 'reviewed', at, questionId: '', materialClaims: 1 },
  { kind: 'reviewed', at, questionId: 'q1', materialClaims: 1, supportedClaims: 2 },
  { kind: 'exported', at, extra: true },
])('rejects invalid event %j', event => {
  expect(domainEventSchema.safeParse(event).success).toBe(false);
});
it.each([
  { kind: 'processing_started', at },
  { kind: 'processing_finished', at },
  { kind: 'exported', at },
  { kind: 'reviewed', at, questionId: 'q1', materialClaims: 2, supportedClaims: 1 },
  { kind: 'first_route', at, questionId: 'q1', route: 'auto_draft' },
  { kind: 'first_route', at, questionId: 'q1', route: 'escalated' },
])('accepts valid event %j', event => {
  expect(domainEventSchema.parse(event)).toEqual(event);
});
