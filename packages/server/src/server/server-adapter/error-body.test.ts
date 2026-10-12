import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { describe, expect, it } from 'vitest';
import { problemDetailsSchema } from '../http-errors';
import { HTTPException } from '../http-exception';
import { toErrorBody, toValidationErrorBody, withProblem } from './error-body';

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

describe('withProblem', () => {
  it('keeps every legacy field and adds a coded problem whose detail is the legacy error', () => {
    const body = withProblem(
      { error: 'Forbidden', message: 'Missing required permission: agents:read' },
      403,
      'PERMISSION_DENIED',
    );

    expect(body).toEqual({
      error: 'Forbidden',
      message: 'Missing required permission: agents:read',
      problem: {
        type: 'urn:mastra:error:PERMISSION_DENIED',
        title: 'Permission denied',
        status: 403,
        code: 'PERMISSION_DENIED',
        detail: 'Forbidden',
      },
    });
    expect(problemDetailsSchema.safeParse(body.problem).success).toBe(true);
  });

  it('masks the detail of a 5xx problem', () => {
    const body = withProblem({ error: 'db password is hunter2' }, 500, 'AUTHORIZATION_FAILED');

    expect(body.problem).not.toHaveProperty('detail');
    expect(JSON.stringify(body.problem)).not.toContain('hunter2');
  });

  it('does not overwrite a problem that is already present', () => {
    const existing = { type: 'about:blank', title: 'Conflict', status: 409 };
    const body = withProblem({ error: 'x', problem: existing }, 409, 'PERMISSION_DENIED');

    expect(body.problem).toBe(existing);
  });

  it('wraps a non-object body (e.g. returned by a user onError hook) under error', () => {
    expect(withProblem('too big', 413, 'REQUEST_BODY_TOO_LARGE')).toEqual({
      error: 'too big',
      problem: expect.objectContaining({ code: 'REQUEST_BODY_TOO_LARGE', status: 413 }),
    });
  });

  it('honours a catalogue code carried by a foreign HTTPException-like error', () => {
    const foreign = Object.assign(new Error('Agent with id x not found'), { status: 404, code: 'AGENT_NOT_FOUND' });
    const { body } = toErrorBody(foreign);
    expect(body.problem).toMatchObject({
      type: 'urn:mastra:error:AGENT_NOT_FOUND',
      code: 'AGENT_NOT_FOUND',
      status: 404,
    });
  });

  it('ignores a code that is not in the catalogue', () => {
    const nodeError = Object.assign(new Error('connect refused'), { status: 502, code: 'ECONNREFUSED' });
    const { body } = toErrorBody(nodeError);
    expect(body.problem.type).toBe('about:blank');
    expect(body.problem).not.toHaveProperty('code');
  });
});
