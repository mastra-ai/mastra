import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import {
  buildDurableResumeEventData,
  buildDurableTriggerEventData,
  mergeResumeRequestContext,
  serializeRequestContext,
} from './durable-event-payload';

describe('durable event payload builders', () => {
  describe('serializeRequestContext', () => {
    it('serializes an absent context to an empty object', () => {
      expect(serializeRequestContext(undefined)).toEqual({});
    });

    it('flattens entries into a plain object', () => {
      const rc = new RequestContext();
      rc.set('tenant', 'acme');
      expect(serializeRequestContext(rc)).toEqual({ tenant: 'acme' });
    });

    it('drops values that cannot survive the JSON round trip through inngest.send', () => {
      // These reach a RequestContext in practice (RPC proxies, callbacks), and
      // a raw `entries()` copy would make the event send throw on the cycle.
      const rc = new RequestContext();
      const cyclic: any = { name: 'cyclic' };
      cyclic.self = cyclic;
      rc.set('tenant', 'acme');
      rc.set('cyclic', cyclic);
      rc.set('fn', () => 'nope');

      const serialized = serializeRequestContext(rc);

      expect(serialized).toEqual({ tenant: 'acme' });
      expect(() => JSON.stringify({ data: { requestContext: serialized } })).not.toThrow();
    });

    it('keeps caller-supplied values off the snapshot base when they are unserializable', () => {
      const rc = new RequestContext();
      const cyclic: any = {};
      cyclic.self = cyclic;
      rc.set('cyclic', cyclic);

      const merged = mergeResumeRequestContext({ tenant: 'acme' }, rc);

      expect(merged).toEqual({ tenant: 'acme' });
      expect(() => JSON.stringify({ data: { requestContext: merged } })).not.toThrow();
    });
  });

  describe('mergeResumeRequestContext', () => {
    it('lets the fresh caller context override snapshot values and keeps the rest', () => {
      const rc = new RequestContext();
      rc.set('tenant', 'fresh');
      expect(mergeResumeRequestContext({ tenant: 'stale', locale: 'en' }, rc)).toEqual({
        tenant: 'fresh',
        locale: 'en',
      });
    });

    it('falls back to the snapshot context when the caller supplies none', () => {
      expect(mergeResumeRequestContext({ tenant: 'stale' }, undefined)).toEqual({ tenant: 'stale' });
    });

    it('returns an empty object when neither side has context', () => {
      expect(mergeResumeRequestContext(undefined, undefined)).toEqual({});
    });
  });

  describe('per-call signals', () => {
    const actor = { actorKind: 'system', sourceWorkflow: 'nightly' } as const;

    it('carries actor and perStep on the trigger payload', () => {
      const data = buildDurableTriggerEventData({
        inputData: { value: 'x' },
        runId: 'run-1',
        actor,
        perStep: true,
      });

      expect(data).toEqual({
        inputData: { value: 'x' },
        runId: 'run-1',
        actor,
        perStep: true,
        requestContext: {},
      });
    });

    it('carries actor and perStep on the resume payload, sourced only from the args', () => {
      const resume = { steps: ['step-a'], resumePayload: { ok: true }, resumePath: [0] };
      const data = buildDurableResumeEventData({
        inputData: { ok: true },
        runId: 'run-1',
        resume,
        // Already-merged snapshot context; an `actor` persisted in a snapshot
        // has no path into the payload because it is a distinct argument.
        requestContext: { tenant: 'acme' },
        actor,
        perStep: false,
      });

      expect(data).toEqual({
        inputData: { ok: true },
        runId: 'run-1',
        resume,
        requestContext: { tenant: 'acme' },
        actor,
        perStep: false,
      });
    });

    it('emits the same per-call signal keys on both the trigger and resume payloads', () => {
      // Guards against a builder dropping one of today's signals. The real net
      // for a *newly added* signal is the shared `PerCallSignals` type, which
      // both builders spread from; this list has to be updated alongside it.
      const signalKeys = ['actor', 'perStep', 'requestContext'];
      const trigger = buildDurableTriggerEventData({ inputData: null, runId: 'r', actor, perStep: true });
      const resume = buildDurableResumeEventData({
        inputData: null,
        runId: 'r',
        resume: { steps: [], resumePayload: null },
        actor,
        perStep: true,
      });

      expect(
        Object.keys(trigger)
          .filter(k => signalKeys.includes(k))
          .sort(),
      ).toEqual(signalKeys);
      expect(
        Object.keys(resume)
          .filter(k => signalKeys.includes(k))
          .sort(),
      ).toEqual(signalKeys);
    });

    it('never sends the framework-managed bearer token in a trigger or resume payload', () => {
      // Inngest durably retains and displays event payloads, so a live token
      // reaching `inngest.send()` is a real disclosure. Pinned here at the
      // chokepoint both send paths now go through.
      const rc = new RequestContext();
      rc.set('tenant', 'acme');
      rc.set(MASTRA_AUTH_TOKEN_KEY, 'live-bearer-token');

      const trigger = buildDurableTriggerEventData({ inputData: null, runId: 'run-1', requestContext: rc });
      const resume = buildDurableResumeEventData({
        inputData: null,
        runId: 'run-1',
        requestContext: mergeResumeRequestContext(undefined, rc),
      });

      expect(trigger.requestContext).toEqual({ tenant: 'acme' });
      expect(resume.requestContext).toEqual({ tenant: 'acme' });
      expect(JSON.stringify(trigger)).not.toContain('live-bearer-token');
      expect(JSON.stringify(resume)).not.toContain('live-bearer-token');
    });

    it('does not invent keys the caller did not supply', () => {
      const data = buildDurableTriggerEventData({ inputData: null, runId: 'run-1' });
      expect(Object.keys(data).sort()).toEqual(['inputData', 'requestContext', 'runId']);
    });
  });
});
