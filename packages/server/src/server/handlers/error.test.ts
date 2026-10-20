import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { describe, expect, it } from 'vitest';

import { HTTPException } from '../http-exception';
import { formatZodError, handleError } from './error';
import type { HandleErrorFallback } from './error';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const FALLBACK: HandleErrorFallback = { message: 'default', code: 'AGENT_GET_FAILED' };

describe('handleError', () => {
  describe('static @mastra/core/agent-builder/ee decoupling', () => {
    // Regression: handleError is wired into every route. Importing
    // `@mastra/core/agent-builder/ee` from this file forces a load-time
    // dependency on a subpath that only ships in @mastra/core >= 1.34.0,
    // causing ERR_MODULE_NOT_FOUND at server startup for deploys whose
    // bundled @mastra/server resolves against an older @mastra/core.
    it('does not import from @mastra/core/agent-builder/ee', () => {
      const src = readFileSync(join(__dirname, 'error.ts'), 'utf8');
      // Match `from '...'` specifiers (any import/export), so the rationale
      // comment in error.ts referencing the subpath is permitted.
      const importSpecifierPattern = /from\s+['"]@mastra\/core\/agent-builder\/ee['"]/;
      expect(src).not.toMatch(importSpecifierPattern);
      // Also guard against `import('@mastra/core/agent-builder/ee')`
      // dynamic imports — same load-time hazard.
      const dynamicImportPattern = /import\(\s*['"]@mastra\/core\/agent-builder\/ee['"]\s*\)/;
      expect(src).not.toMatch(dynamicImportPattern);
      // And bare side-effect imports: `import '@mastra/core/agent-builder/ee'`.
      const sideEffectPattern = /(?:^|\n)\s*import\s+['"]@mastra\/core\/agent-builder\/ee['"]/;
      expect(src).not.toMatch(sideEffectPattern);
    });
  });

  it('uses an explicit status from MastraError details', () => {
    const err = new MastraError({
      id: 'OBSERVATIONAL_MEMORY_THREAD_ID_REQUIRED',
      domain: ErrorDomain.MASTRA_MEMORY,
      category: ErrorCategory.USER,
      text: 'ObservationalMemory requires a threadId',
      details: { status: 400 },
    });

    expect(() => handleError(err, FALLBACK)).toThrow(
      expect.objectContaining({
        status: 400,
        message: 'ObservationalMemory requires a threadId',
      }),
    );
  });

  describe('MODEL_NOT_ALLOWED handling', () => {
    function makeModelNotAllowedError() {
      return Object.assign(new Error('Model not allowed: __GATEWAY_ANTHROPIC_MODEL_OPUS__ (static)'), {
        code: 'MODEL_NOT_ALLOWED' as const,
        allowed: [{ provider: 'openai', modelId: '__GATEWAY_OPENAI_MODEL__' }],
        attempted: { provider: 'anthropic', modelId: '__GATEWAY_ANTHROPIC_MODEL_OPUS__' },
        offendingLabel: 'static',
      });
    }

    it('throws an HTTPException with status 422 when the error has code MODEL_NOT_ALLOWED', () => {
      const err = makeModelNotAllowedError();
      let caught: unknown;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect((caught as HTTPException).status).toBe(422);
      expect((caught as HTTPException).cause).toBe(err);
    });

    it('writes a JSON body with code, message, allowed, attempted, offendingLabel', async () => {
      const err = makeModelNotAllowedError();
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeDefined();
      const res = caught!.getResponse();
      expect(res.status).toBe(422);
      expect(res.headers.get('content-type')).toBe('application/json');
      const body = await res.json();
      expect(body).toEqual({
        error: {
          code: 'MODEL_NOT_ALLOWED',
          message: err.message,
          allowed: err.allowed,
          attempted: err.attempted,
          offendingLabel: err.offendingLabel,
        },
        problem: {
          code: 'MODEL_NOT_ALLOWED',
          metadata: { allowed: err.allowed, attempted: err.attempted, offendingLabel: err.offendingLabel },
        },
      });
    });

    it('falls through to default handling when code is not MODEL_NOT_ALLOWED', () => {
      const err = Object.assign(new Error('boom'), { status: 418 });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(418);
      expect(caught!.message).toBe('boom');
    });

    it('falls through to default handling when error is not an Error instance', () => {
      let caught: HTTPException | undefined;
      try {
        handleError({ code: 'MODEL_NOT_ALLOWED' } as unknown, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      // Non-Error inputs must not be treated as model-not-allowed; same
      // surface as the original predicate in @mastra/core's EE errors module.
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).not.toBe(422);
    });
  });

  describe('AGENT_RESUME_ALREADY_CLAIMED', () => {
    it('maps a losing concurrent approval or resume to 409', () => {
      const err = Object.assign(new Error('already being resumed'), { id: 'AGENT_RESUME_ALREADY_CLAIMED' });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(409);
      expect(caught!.message).toBe('already being resumed');
    });
  });

  describe.each(['AGENT_RESUME_RUN_NOT_SUSPENDED', 'WORKFLOW_RUN_NOT_SUSPENDED'])('%s', id => {
    it('maps resuming a run that is not waiting to be resumed to 409', () => {
      const err = Object.assign(new Error('not suspended'), { id });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(409);
      expect(caught!.message).toBe('not suspended');
    });
  });

  describe('WORKFLOW_RESUME_ALREADY_CLAIMED', () => {
    it('maps a losing concurrent resume to 409', () => {
      const err = Object.assign(new Error('already resumed'), { id: 'WORKFLOW_RESUME_ALREADY_CLAIMED' });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(409);
      expect(caught!.message).toBe('already resumed');
    });

    it('does not treat other workflow errors as a conflict', () => {
      const err = Object.assign(new Error('boom'), { id: 'SOME_OTHER_ID' });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught!.status).not.toBe(409);
    });
  });

  describe('time travel conflicts', () => {
    it.each(['WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED', 'WORKFLOW_TIME_TRAVEL_RUN_RUNNING'])('maps %s to 409', id => {
      const err = Object.assign(new Error('already claimed'), { id });
      let caught: HTTPException | undefined;
      try {
        handleError(err, 'default');
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(409);
      expect(caught!.message).toBe('already claimed');
    });
  });

  describe('durable agent run conflicts', () => {
    it.each([
      'DURABLE_AGENT_RUN_ACTIVE',
      'DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY',
      'DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS',
      'DURABLE_AGENT_RECOVER_RUN_SUSPENDED',
      'DURABLE_AGENT_EXECUTION_CONFLICT',
    ])('maps %s to 409 and keeps the message', id => {
      const err = Object.assign(new Error('run is busy'), { id });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(409);
      expect(caught!.message).toBe('run is busy');
    });

    it('keeps run ids and the retry hint but drops lease internals from problem metadata', () => {
      const err = Object.assign(new Error('run is busy'), {
        id: 'DURABLE_AGENT_RUN_ACTIVE',
        details: {
          agentId: 'agent-1',
          runId: 'run-1',
          liveBy: 'lease',
          holder: 'worker-7:pid-42',
          leaseExpiresAt: '2026-10-20T09:00:00.000Z',
          retryAt: 1_792_000_000_000,
        },
      });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught!.problem).toEqual({
        code: 'DURABLE_AGENT_RUN_ACTIVE',
        metadata: { agentId: 'agent-1', runId: 'run-1', retryAt: 1_792_000_000_000 },
      });
    });

    it('does not treat a superseded execution as a request conflict', () => {
      const err = Object.assign(new Error('superseded'), { id: 'DURABLE_AGENT_EXECUTION_SUPERSEDED' });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught!.status).not.toBe(409);
    });
  });

  describe('OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT', () => {
    it('maps a superseded review-status update to 409', () => {
      const err = Object.assign(new Error('feedback changed'), {
        id: 'OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT',
      });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(409);
      expect(caught!.message).toBe('feedback changed');
    });
  });

  describe('OBSERVABILITY_STORAGE_*_NOT_IMPLEMENTED', () => {
    it('maps a missing optional storage capability to 501 with the original message', () => {
      const err = Object.assign(new Error('This storage provider does not support listing feedback'), {
        id: 'OBSERVABILITY_STORAGE_LIST_FEEDBACK_NOT_IMPLEMENTED',
      });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(501);
      expect(caught!.message).toBe('This storage provider does not support listing feedback');
    });

    it('does not treat other observability storage errors as unsupported', () => {
      const err = Object.assign(new Error('query failed'), {
        id: 'OBSERVABILITY_STORAGE_LIST_FEEDBACK_FAILED',
      });
      let caught: HTTPException | undefined;
      try {
        handleError(err, FALLBACK);
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(500);
    });
  });

  describe('problem resolution', () => {
    function capture(error: unknown, fallback: HandleErrorFallback = FALLBACK): HTTPException {
      try {
        handleError(error, fallback);
      } catch (e) {
        return e as HTTPException;
      }
      throw new Error('handleError did not throw');
    }

    it('rethrows an HTTPException unchanged', () => {
      const original = new HTTPException(404, {
        message: 'Agent with id x not found',
        code: 'AGENT_NOT_FOUND',
        metadata: { agentId: 'x' },
      });
      expect(capture(original)).toBe(original);
    });

    it('uses the fallback code and metadata for an unknown error', async () => {
      const caught = capture(new Error('boom'), { ...FALLBACK, metadata: { agentId: 'a1' } });
      expect(caught.status).toBe(500);
      expect(caught.problem).toEqual({ code: 'AGENT_GET_FAILED', metadata: { agentId: 'a1' } });
      await expect(caught.getResponse().json()).resolves.toEqual({
        error: 'boom',
        problem: { code: 'AGENT_GET_FAILED', metadata: { agentId: 'a1' } },
      });
    });

    it('omits metadata when there is nothing to add', () => {
      expect(capture(new Error('boom')).problem).toEqual({ code: 'AGENT_GET_FAILED' });
    });

    it('keeps an error id that is already a catalog code', () => {
      const err = Object.assign(new Error('missing'), { id: 'WORKFLOW_NOT_FOUND', status: 404 });
      const caught = capture(err);
      expect(caught.status).toBe(404);
      expect(caught.problem.code).toBe('WORKFLOW_NOT_FOUND');
    });

    it('falls back for an error id outside the catalog', () => {
      const err = Object.assign(new Error('boom'), { id: 'SOME_INTERNAL_ID' });
      expect(capture(err).problem.code).toBe('AGENT_GET_FAILED');
    });

    it('maps resume conflicts to their id and merges MastraError details', () => {
      const err = new MastraError({
        id: 'WORKFLOW_RESUME_ALREADY_CLAIMED',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text: 'already resumed',
        details: { runId: 'run-1' },
      });
      const caught = capture(err, { ...FALLBACK, metadata: { workflowId: 'wf-1' } });
      expect(caught.status).toBe(409);
      expect(caught.problem).toEqual({
        code: 'WORKFLOW_RESUME_ALREADY_CLAIMED',
        metadata: { workflowId: 'wf-1', runId: 'run-1' },
      });
    });

    it('maps durable run conflicts to their id', () => {
      const err = Object.assign(new Error('busy'), { id: 'DURABLE_AGENT_RUN_ACTIVE' });
      expect(capture(err).problem.code).toBe('DURABLE_AGENT_RUN_ACTIVE');
    });

    it('maps the feedback review-status conflict', () => {
      const err = Object.assign(new Error('changed'), { id: 'OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT' });
      expect(capture(err).problem.code).toBe('OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT');
    });

    it('maps workflow schema validation failures', () => {
      const err = Object.assign(new Error('bad input'), { id: 'WORKFLOW_SCHEMA_VALIDATION_FAILED' });
      const caught = capture(err);
      expect(caught.status).toBe(400);
      expect(caught.problem.code).toBe('WORKFLOW_SCHEMA_VALIDATION_FAILED');
    });

    it('maps every unimplemented observability storage method to OBSERVABILITY_OPERATION_NOT_SUPPORTED', () => {
      const err = Object.assign(new Error('unsupported'), { id: 'OBSERVABILITY_STORAGE_LIST_METRICS_NOT_IMPLEMENTED' });
      expect(capture(err).problem).toEqual({ code: 'OBSERVABILITY_OPERATION_NOT_SUPPORTED' });
    });
  });

  describe('string fallback (pre-catalog signature)', () => {
    function capture(error: unknown, message: string): HTTPException {
      try {
        handleError(error, message);
      } catch (e) {
        return e as HTTPException;
      }
      throw new Error('handleError did not throw');
    }

    it('uses the string as the message and UNEXPECTED_ERROR for an error without status', () => {
      const caught = capture({}, 'Error getting agent');
      expect(caught.status).toBe(500);
      expect(caught.message).toBe('Error getting agent');
      expect(caught.problem).toEqual({ code: 'UNEXPECTED_ERROR' });
    });

    it('uses UNCATEGORIZED_ERROR for an error that carries a status', () => {
      const caught = capture(Object.assign(new Error('nope'), { status: 403 }), 'Error getting agent');
      expect(caught.status).toBe(403);
      expect(caught.problem).toEqual({ code: 'UNCATEGORIZED_ERROR' });
    });

    it('keeps an error id that is already a catalog code', () => {
      const err = Object.assign(new Error('missing'), { id: 'AGENT_NOT_FOUND', status: 404 });
      expect(capture(err, 'Error getting agent').problem.code).toBe('AGENT_NOT_FOUND');
    });
  });
});

describe('HTTPException', () => {
  it('defaults to status 500 and UNCATEGORIZED_ERROR without options', () => {
    const error = new HTTPException();
    expect(error.status).toBe(500);
    expect(error.problem).toEqual({ code: 'UNCATEGORIZED_ERROR' });
  });

  it('defaults the code to UNCATEGORIZED_ERROR when only a message is given', () => {
    const error = new HTTPException(404, { message: 'Not here' });
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not here');
    expect(error.problem).toEqual({ code: 'UNCATEGORIZED_ERROR' });
  });
});

describe('formatZodError', () => {
  it('uses REQUEST_VALIDATION_FAILED by default', () => {
    const body = formatZodError({ issues: [{ path: ['name'], message: 'Required' }] }, 'request body', 'body');

    expect(body.problem).toEqual({
      code: 'REQUEST_VALIDATION_FAILED',
      metadata: { issues: [{ field: 'name', message: 'Required' }], location: 'body' },
    });
  });

  it('uses the catalog code carried by a custom issue', () => {
    const body = formatZodError(
      {
        issues: [
          { path: ['name'], message: 'Required' },
          { path: ['limit'], message: 'bad limit', params: { problemCode: 'AGENT_CONTROLLER_LIMIT_REQUIRES_PAGE' } },
        ],
      },
      'query parameters',
    );

    expect(body.problem.code).toBe('AGENT_CONTROLLER_LIMIT_REQUIRES_PAGE');
  });

  it('ignores problem codes that are not in the catalog', () => {
    const body = formatZodError(
      { issues: [{ path: ['limit'], message: 'bad limit', params: { problemCode: 'NOT_A_REAL_CODE' } }] },
      'query parameters',
    );

    expect(body.problem.code).toBe('REQUEST_VALIDATION_FAILED');
  });
});
