import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { HTTPException } from '../http-exception';
import { handleError } from './error';

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
});
