import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { describe, expect, it } from 'vitest';

import { HTTPException } from '../http-exception';
import { handleError, publicCodeForError } from './error';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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

    expect(() => handleError(err, 'default')).toThrow(
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
        handleError(err, 'default');
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
        handleError(err, 'default');
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
          type: 'urn:mastra:error:MODEL_NOT_ALLOWED',
          title: 'Model not allowed',
          status: 422,
          detail: err.message,
          code: 'MODEL_NOT_ALLOWED',
        },
      });
    });

    it('falls through to default handling when code is not MODEL_NOT_ALLOWED', () => {
      const err = Object.assign(new Error('boom'), { status: 418 });
      let caught: HTTPException | undefined;
      try {
        handleError(err, 'default');
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
        handleError({ code: 'MODEL_NOT_ALLOWED' } as unknown, 'default');
      } catch (e) {
        caught = e as HTTPException;
      }
      // Non-Error inputs must not be treated as model-not-allowed; same
      // surface as the original predicate in @mastra/core's EE errors module.
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).not.toBe(422);
    });
  });

  describe('WORKFLOW_RESUME_ALREADY_CLAIMED', () => {
    it('maps a losing concurrent resume to 409', () => {
      const err = Object.assign(new Error('already resumed'), { id: 'WORKFLOW_RESUME_ALREADY_CLAIMED' });
      let caught: HTTPException | undefined;
      try {
        handleError(err, 'default');
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
        handleError(err, 'default');
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught!.status).not.toBe(409);
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
        handleError(err, 'default');
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(409);
      expect(caught!.message).toBe('run is busy');
    });

    it('does not treat a superseded execution as a request conflict', () => {
      const err = Object.assign(new Error('superseded'), { id: 'DURABLE_AGENT_EXECUTION_SUPERSEDED' });
      let caught: HTTPException | undefined;
      try {
        handleError(err, 'default');
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
        handleError(err, 'default');
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
        handleError(err, 'default');
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
        handleError(err, 'default');
      } catch (e) {
        caught = e as HTTPException;
      }
      expect(caught).toBeInstanceOf(HTTPException);
      expect(caught!.status).toBe(500);
    });
  });

  describe('business error codes', () => {
    function catchError(err: unknown): HTTPException {
      try {
        handleError(err, 'default');
      } catch (e) {
        return e as HTTPException;
      }
      throw new Error('handleError did not throw');
    }

    it('exposes MODEL_NOT_ALLOWED on the exception', () => {
      const err = Object.assign(new Error('nope'), { code: 'MODEL_NOT_ALLOWED' as const });
      expect(catchError(err).code).toBe('MODEL_NOT_ALLOWED');
    });

    it.each([
      ['WORKFLOW_SCHEMA_VALIDATION_FAILED', 'WORKFLOW_SCHEMA_VALIDATION_FAILED'],
      ['WORKFLOW_RESUME_ALREADY_CLAIMED', 'WORKFLOW_RESUME_ALREADY_CLAIMED'],
      ['DURABLE_AGENT_RUN_ACTIVE', 'DURABLE_RUN_ACTIVE'],
      ['DURABLE_AGENT_RECOVER_RUN_ACTIVE_LOCALLY', 'DURABLE_RUN_ACTIVE'],
      ['DURABLE_AGENT_RECOVER_ALREADY_IN_PROGRESS', 'DURABLE_RUN_RECOVERY_IN_PROGRESS'],
      ['DURABLE_AGENT_RECOVER_RUN_SUSPENDED', 'DURABLE_RUN_SUSPENDED'],
      ['DURABLE_AGENT_EXECUTION_CONFLICT', 'DURABLE_RUN_EXECUTION_CONFLICT'],
      ['OBSERVABILITY_UPDATE_FEEDBACK_REVIEW_STATUS_CONFLICT', 'FEEDBACK_REVIEW_STATUS_CONFLICT'],
      ['OBSERVABILITY_STORAGE_LIST_FEEDBACK_NOT_IMPLEMENTED', 'OBSERVABILITY_FEATURE_NOT_IMPLEMENTED'],
      ['OBSERVABILITY_STORAGE_LIST_LOGS_NOT_IMPLEMENTED', 'OBSERVABILITY_FEATURE_NOT_IMPLEMENTED'],
    ])('maps internal id %s to public code %s', (id, code) => {
      const caught = catchError(Object.assign(new Error('boom'), { id }));
      expect(caught.code).toBe(code);
    });

    it('does not leak internal ids of unknown MastraErrors', () => {
      const err = new MastraError({
        id: 'SOME_INTERNAL_FAILURE',
        domain: ErrorDomain.MASTRA_MEMORY,
        category: ErrorCategory.SYSTEM,
        text: 'internal failure',
      });
      const caught = catchError(err);
      expect(caught.code).toBeUndefined();
    });

    it('preserves the code of an HTTPException that is re-thrown through handleError', () => {
      const original = new HTTPException(404, { message: 'Agent not found', code: 'AGENT_NOT_FOUND' });
      const caught = catchError(original);
      expect(caught.status).toBe(404);
      expect(caught.message).toBe('Agent not found');
      expect(caught.code).toBe('AGENT_NOT_FOUND');
    });

    it('maps the internal NO_MODEL_SELECTED id to the public code via publicCodeForError', () => {
      const err = new MastraError({
        id: 'NO_MODEL_SELECTED',
        domain: ErrorDomain.MASTRA_SERVER,
        category: ErrorCategory.USER,
        text: 'No model selected',
      });
      expect(publicCodeForError(err)).toBe('NO_MODEL_SELECTED');
    });

    it.each([
      ['DATASET_NOT_FOUND', 'DATASET_NOT_FOUND'],
      ['DATASET_ITEM_NOT_FOUND', 'DATASET_ITEM_NOT_FOUND'],
      ['EXPERIMENT_NOT_FOUND', 'EXPERIMENT_NOT_FOUND'],
      ['EXPERIMENT_NO_ITEMS', 'EXPERIMENT_NO_ITEMS'],
      ['EXPERIMENT_HAS_TARGET', 'EXPERIMENT_TARGET_INVALID'],
      ['EXPERIMENT_HAS_NO_TARGET', 'EXPERIMENT_TARGET_INVALID'],
      ['EXPERIMENT_INVALID_TARGET', 'EXPERIMENT_TARGET_INVALID'],
      ['EXPERIMENT_TARGET_NOT_FOUND', 'EXPERIMENT_TARGET_NOT_FOUND'],
      ['DATASET_ITEM_IDENTITY_CONFLICT', 'DATASET_ITEM_IDENTITY_CONFLICT'],
      ['EXPERIMENT_ID_CONFLICT', 'EXPERIMENT_ID_CONFLICT'],
      ['EXPERIMENT_ALREADY_FINALIZED', 'EXPERIMENT_ALREADY_FINALIZED'],
      ['DATASET_ITEM_EXTERNAL_ID_INVALID', 'DATASET_ITEM_EXTERNAL_ID_INVALID'],
      ['DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE', 'DATASET_ITEM_PAYLOAD_NOT_SERIALIZABLE'],
      ['DATASET_SCHEMA_PATTERN_UNSUPPORTED', 'DATASET_SCHEMA_PATTERN_UNSUPPORTED'],
    ])('maps the internal dataset error id %s to the public %s code', (id, code) => {
      const err = new MastraError({ id, domain: ErrorDomain.STORAGE, category: ErrorCategory.USER, text: id });
      expect(publicCodeForError(err)).toBe(code);
    });

    it.each([
      ['MASTRA_GET_AGENT_BY_NAME_NOT_FOUND', 'AGENT_NOT_FOUND'],
      ['MASTRA_GET_AGENT_BY_AGENT_ID_NOT_FOUND', 'AGENT_NOT_FOUND'],
      ['MASTRA_GET_WORKFLOW_BY_ID_NOT_FOUND', 'WORKFLOW_NOT_FOUND'],
      ['MASTRA_GET_INTERNAL_WORKFLOW_BY_ID_NOT_FOUND', 'WORKFLOW_NOT_FOUND'],
      ['MASTRA_GET_VECTOR_BY_NAME_NOT_FOUND', 'VECTOR_STORE_NOT_FOUND'],
      ['MASTRA_GET_VECTOR_BY_ID_NOT_FOUND', 'VECTOR_STORE_NOT_FOUND'],
      ['MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND', 'WORKSPACE_NOT_FOUND'],
      ['MASTRA_GET_SCORER_NOT_FOUND', 'SCORER_NOT_FOUND'],
      ['MASTRA_GET_SCORER_BY_ID_NOT_FOUND', 'SCORER_NOT_FOUND'],
      ['MASTRA_GET_TOOL_BY_NAME_NOT_FOUND', 'TOOL_NOT_FOUND'],
      ['MASTRA_GET_TOOL_BY_ID_NOT_FOUND', 'TOOL_NOT_FOUND'],
      ['MASTRA_GET_PROCESSOR_BY_NAME_NOT_FOUND', 'PROCESSOR_NOT_FOUND'],
      ['MASTRA_GET_PROCESSOR_BY_ID_NOT_FOUND', 'PROCESSOR_NOT_FOUND'],
      ['MASTRA_GET_PROMPT_BLOCK_NOT_FOUND', 'PROMPT_BLOCK_NOT_FOUND'],
      ['MASTRA_GET_PROMPT_BLOCK_BY_ID_NOT_FOUND', 'PROMPT_BLOCK_NOT_FOUND'],
    ])('maps the core lookup error id %s to the public %s code', (id, code) => {
      const err = new MastraError({
        id,
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: id,
        details: { status: 404 },
      });
      expect(publicCodeForError(err)).toBe(code);
      expect(catchError(err).code).toBe(code);
    });

    it('returns no public code for unknown internal ids', () => {
      expect(publicCodeForError(new Error('x'))).toBeUndefined();
      expect(publicCodeForError({ id: 'SOME_INTERNAL_FAILURE' })).toBeUndefined();
    });

    it('does not expose a code on a plain error with a status', () => {
      const caught = catchError(Object.assign(new Error('teapot'), { status: 418 }));
      expect(caught.code).toBeUndefined();
    });
  });
});
