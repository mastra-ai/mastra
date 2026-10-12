import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { describe, expect, it } from 'vitest';
import { problemDetailsSchema } from '../http-errors';
import { HTTPException } from '../http-exception';
import { toErrorBody, toValidationErrorBody } from './error-body';

describe('toErrorBody', () => {
  describe('given an HTTPException carrying a business code', () => {
    it('keeps the legacy error field and adds a problem with the code', () => {
      const { status, body } = toErrorBody(
        new HTTPException(404, { message: 'Agent not found', code: 'AGENT_NOT_FOUND' }),
      );

      expect(status).toBe(404);
      expect(body).toEqual({
        error: 'Agent not found',
        problem: {
          type: 'urn:mastra:error:AGENT_NOT_FOUND',
          title: 'Agent not found',
          status: 404,
          code: 'AGENT_NOT_FOUND',
          detail: 'Agent not found',
        },
      });
      expect(problemDetailsSchema.safeParse(body.problem).success).toBe(true);
    });
  });

  describe('given an HTTPException without a code', () => {
    it('emits an about:blank problem without a code', () => {
      const { status, body } = toErrorBody(new HTTPException(404, { message: 'Legacy fallback' }));

      expect(status).toBe(404);
      expect(body.error).toBe('Legacy fallback');
      expect(body.problem).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Legacy fallback',
      });
      expect(body.problem).not.toHaveProperty('code');
    });
  });

  describe('given an unexpected 500 error', () => {
    it('masks the detail in the problem and never exposes a code', () => {
      const { status, body } = toErrorBody(new Error('db password is hunter2'));

      expect(status).toBe(500);
      expect(body.problem).toEqual({ type: 'about:blank', title: 'Internal Server Error', status: 500 });
      expect(JSON.stringify(body.problem)).not.toContain('hunter2');
    });
  });

  describe('given a MastraError carrying its status in details', () => {
    it('uses the details status and exposes no internal id as a code', () => {
      const err = new MastraError({
        id: 'SOME_INTERNAL_FAILURE',
        domain: ErrorDomain.MASTRA_MEMORY,
        category: ErrorCategory.USER,
        text: 'nope',
        details: { status: 429 },
      });
      const { status, body } = toErrorBody(err);

      expect(status).toBe(429);
      expect(body.problem).not.toHaveProperty('code');
      expect(JSON.stringify(body.problem)).not.toContain('SOME_INTERNAL_FAILURE');
    });
  });
});

describe('toValidationErrorBody', () => {
  it.each([
    ['body', 'Invalid request body', 'INVALID_REQUEST_BODY'],
    ['query', 'Invalid query parameters', 'INVALID_QUERY_PARAMS'],
    ['path', 'Invalid path parameters', 'INVALID_PATH_PARAMS'],
  ] as const)(
    'given a %s validation failure, keeps error/issues and adds a coded problem',
    (context, message, code) => {
      const issues = [{ field: 'name', message: 'Required' }];
      const body = toValidationErrorBody({ error: message, issues }, context);

      expect(body.error).toBe(message);
      expect(body.issues).toEqual(issues);
      expect(body.problem).toMatchObject({
        type: `urn:mastra:error:${code}`,
        status: 400,
        code,
        detail: message,
        issues,
      });
      expect(problemDetailsSchema.safeParse(body.problem).success).toBe(true);
    },
  );
});
