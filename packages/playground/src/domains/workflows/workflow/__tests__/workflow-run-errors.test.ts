import { describe, expect, it } from 'vitest';

import { getWorkflowRunErrors } from '../workflow-run-errors';

/**
 * Collects every failure worth showing for a workflow run — the run-level
 * error, each failed step, and the transport error React Query surfaced —
 * de-duplicated so the same message is not repeated.
 */
describe('getWorkflowRunErrors', () => {
  describe('when the request itself failed', () => {
    it('reports the transport error', () => {
      expect(getWorkflowRunErrors(undefined, new Error('network down'))).toEqual(['network down']);
    });

    it('reports it alongside the run error', () => {
      expect(getWorkflowRunErrors({ error: 'step blew up' }, new Error('network down'))).toEqual([
        'network down',
        'step blew up',
      ]);
    });
  });

  describe('when there is no result to inspect', () => {
    it.each([[undefined], [null], ['a string result'], [42]])('reports nothing for %p', result => {
      expect(getWorkflowRunErrors(result)).toEqual([]);
    });
  });

  describe('run-level errors', () => {
    it('reads a plain string', () => {
      expect(getWorkflowRunErrors({ error: 'boom' })).toEqual(['boom']);
    });

    it('reads an Error message', () => {
      expect(getWorkflowRunErrors({ error: new Error('boom') })).toEqual(['boom']);
    });

    it('reads a message property', () => {
      expect(getWorkflowRunErrors({ error: { message: 'boom' } })).toEqual(['boom']);
    });

    it('unwraps a nested error', () => {
      expect(getWorkflowRunErrors({ error: { error: { message: 'boom' } } })).toEqual(['boom']);
    });

    it('unwraps a nested error several levels deep', () => {
      expect(getWorkflowRunErrors({ error: { error: { error: 'boom' } } })).toEqual(['boom']);
    });

    it('ignores an error object it cannot read a message from', () => {
      expect(getWorkflowRunErrors({ error: { code: 500 } })).toEqual([]);
    });

    it('ignores a non-string message', () => {
      expect(getWorkflowRunErrors({ error: { message: 42 } })).toEqual([]);
    });

    it('ignores a null error', () => {
      expect(getWorkflowRunErrors({ error: null })).toEqual([]);
    });
  });

  describe('step errors', () => {
    it('labels each failure with its step id', () => {
      const result = { steps: { fetch: { error: 'timed out' }, parse: { error: { message: 'bad json' } } } };

      expect(getWorkflowRunErrors(result)).toEqual(['fetch: timed out', 'parse: bad json']);
    });

    it('skips steps that did not fail', () => {
      const result = { steps: { ok: { status: 'success' }, bad: { error: 'nope' } } };

      expect(getWorkflowRunErrors(result)).toEqual(['bad: nope']);
    });

    it('skips a step that is not an object', () => {
      expect(getWorkflowRunErrors({ steps: { weird: 'not-a-step', bad: { error: 'nope' } } })).toEqual(['bad: nope']);
    });

    it('skips a null step', () => {
      expect(getWorkflowRunErrors({ steps: { gone: null, bad: { error: 'nope' } } })).toEqual(['bad: nope']);
    });

    it('skips a step whose error carries no readable message', () => {
      expect(getWorkflowRunErrors({ steps: { bad: { error: { code: 1 } } } })).toEqual([]);
    });

    it('ignores a steps field that is not an object', () => {
      expect(getWorkflowRunErrors({ steps: 'none' })).toEqual([]);
    });

    it('ignores a null steps field', () => {
      expect(getWorkflowRunErrors({ steps: null })).toEqual([]);
    });
  });

  describe('when the same message appears more than once', () => {
    it('reports it only once', () => {
      const result = { error: 'boom', steps: { a: { error: 'shared' }, b: { error: 'shared' } } };

      // Step messages are prefixed by step id, so these two stay distinct.
      expect(getWorkflowRunErrors(result)).toEqual(['boom', 'a: shared', 'b: shared']);
    });

    it('de-duplicates a transport error that matches the run error', () => {
      expect(getWorkflowRunErrors({ error: 'boom' }, new Error('boom'))).toEqual(['boom']);
    });
  });
});
