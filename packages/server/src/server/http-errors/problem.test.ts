import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod/v4';

import { buildProblem } from './build-problem';
import { MASTRA_ERROR_CODES } from './codes';
import type { MastraErrorCode } from './codes';
import { problemDetailsSchema } from './problem';
import type { ProblemDetails } from './problem';

describe('problemDetailsSchema', () => {
  const valid = { type: 'about:blank', title: 'Not Found', status: 404 };

  describe('given a minimal problem', () => {
    it('accepts type, title and status', () => {
      expect(problemDetailsSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe('given every optional member', () => {
    it('accepts detail, instance, code and issues', () => {
      const result = problemDetailsSchema.safeParse({
        ...valid,
        detail: 'Agent "x" does not exist',
        instance: '/api/agents/x',
        code: 'AGENT_NOT_FOUND',
        issues: [{ field: 'name', message: 'Required' }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('given a status outside 400-599', () => {
    it.each([200, 399, 600])('rejects %i', status => {
      expect(problemDetailsSchema.safeParse({ ...valid, status }).success).toBe(false);
    });
  });

  describe('given missing required members', () => {
    it.each(['type', 'title', 'status'])('rejects a problem without %s', key => {
      const { [key]: _removed, ...rest } = valid as Record<string, unknown>;
      expect(problemDetailsSchema.safeParse(rest).success).toBe(false);
    });
  });

  it('exposes ProblemDetails as the inferred type of the schema', () => {
    expectTypeOf<ProblemDetails>().toEqualTypeOf<z.infer<typeof problemDetailsSchema>>();
  });
});

describe('buildProblem', () => {
  describe('given a business code', () => {
    it('derives type, title and code from the catalogue', () => {
      const problem = buildProblem({ status: 404, code: 'AGENT_NOT_FOUND', detail: 'Agent not found' });
      expect(problem).toEqual({
        type: 'urn:mastra:error:AGENT_NOT_FOUND',
        title: 'Agent not found',
        status: 404,
        code: 'AGENT_NOT_FOUND',
        detail: 'Agent not found',
      });
    });

    it('produces something the schema accepts', () => {
      const code: MastraErrorCode = MASTRA_ERROR_CODES.THREAD_ACCESS_DENIED;
      expect(problemDetailsSchema.safeParse(buildProblem({ status: 403, code })).success).toBe(true);
    });

    it.each(Object.values(MASTRA_ERROR_CODES))('gives %s a human-readable title', code => {
      const { title } = buildProblem({ status: 400, code });
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toBe(code);
    });
  });

  describe('given no code', () => {
    it('uses about:blank and omits the code key', () => {
      const problem = buildProblem({ status: 404, detail: 'nope' });
      expect(problem.type).toBe('about:blank');
      expect(problem.title).toBe('Not Found');
      expect('code' in problem).toBe(false);
    });

    it('falls back to a generic title for unknown statuses', () => {
      expect(buildProblem({ status: 599 }).title).toBe('Error');
    });
  });

  describe('given a server error (5xx)', () => {
    it('masks the detail so internals do not leak', () => {
      const problem = buildProblem({ status: 500, detail: 'ECONNREFUSED 10.0.0.3:5432' });
      expect('detail' in problem).toBe(false);
      expect(problem.title).toBe('Internal Server Error');
    });

    it('also masks the detail of a coded 5xx', () => {
      const problem = buildProblem({ status: 500, code: 'STORAGE_NOT_CONFIGURED', detail: 'secret' });
      expect('detail' in problem).toBe(false);
      expect(problem.code).toBe('STORAGE_NOT_CONFIGURED');
    });
  });

  describe('given validation issues', () => {
    it('keeps them on the problem', () => {
      const issues = [{ field: 'name', message: 'Required' }];
      const problem = buildProblem({ status: 400, code: 'INVALID_REQUEST_BODY', issues });
      expect(problem.issues).toEqual(issues);
    });
  });

  describe('given an instance', () => {
    it('keeps it on the problem', () => {
      expect(buildProblem({ status: 404, instance: '/api/agents/x' }).instance).toBe('/api/agents/x');
    });
  });
});
