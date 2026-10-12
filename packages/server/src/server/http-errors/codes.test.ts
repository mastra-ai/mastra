import { describe, expect, it } from 'vitest';

import { MASTRA_ERROR_CODES, isMastraErrorCode } from './codes';

const GENERIC_HTTP_STATUS_NAMES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'INTERNAL_ERROR',
  'INTERNAL_SERVER_ERROR',
  'NOT_IMPLEMENTED',
  'SERVICE_UNAVAILABLE',
];

describe('MASTRA_ERROR_CODES catalogue', () => {
  const entries = Object.entries(MASTRA_ERROR_CODES);

  it('is not empty', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  describe('given every code in the catalogue', () => {
    it.each(entries)('%s is SCREAMING_SNAKE_CASE', code => {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    });

    it.each(entries)('%s carries a non-empty title and an error status', (_code, def) => {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.status).toBeGreaterThanOrEqual(400);
      expect(def.status).toBeLessThanOrEqual(599);
    });

    it('has unique titles, so a code is never a synonym of another', () => {
      const titles = entries.map(([, def]) => def.title);
      expect(new Set(titles).size).toBe(titles.length);
    });
  });

  describe('given the HTTP status already conveys the generic category', () => {
    it('does not define codes that merely restate an HTTP status', () => {
      for (const generic of GENERIC_HTTP_STATUS_NAMES) {
        expect(Object.keys(MASTRA_ERROR_CODES)).not.toContain(generic);
      }
    });
  });

  describe('given the business codes of the plan', () => {
    it.each([
      ['AGENT_NOT_FOUND', 404],
      ['MODEL_NOT_ALLOWED', 422],
      ['NO_MODEL_SELECTED', 400],
      ['WORKFLOW_NOT_FOUND', 404],
      ['WORKFLOW_RUN_NOT_FOUND', 404],
      ['WORKFLOW_SCHEMA_VALIDATION_FAILED', 400],
      ['WORKFLOW_RESUME_ALREADY_CLAIMED', 409],
      ['DURABLE_RUN_ACTIVE', 409],
      ['DURABLE_RUN_RECOVERY_IN_PROGRESS', 409],
      ['DURABLE_RUN_SUSPENDED', 409],
      ['DURABLE_RUN_EXECUTION_CONFLICT', 409],
      ['DURABLE_RUN_ACCESS_DENIED', 403],
      ['THREAD_NOT_FOUND', 404],
      ['THREAD_ACCESS_DENIED', 403],
      ['TOOL_NOT_FOUND', 404],
      ['PROCESSOR_NOT_FOUND', 404],
      ['WORKSPACE_NOT_FOUND', 404],
      ['SCHEDULE_NOT_FOUND', 404],
      ['BACKGROUND_TASK_NOT_FOUND', 404],
      ['STORAGE_NOT_CONFIGURED', 500],
      ['STORAGE_DOMAIN_UNAVAILABLE', 500],
      ['OBSERVABILITY_FEATURE_NOT_IMPLEMENTED', 501],
      ['FEEDBACK_REVIEW_STATUS_CONFLICT', 409],
      ['INVALID_REQUEST_BODY', 400],
      ['INVALID_QUERY_PARAMS', 400],
      ['INVALID_PATH_PARAMS', 400],
    ])('defines %s with default status %i', (code, status) => {
      expect(MASTRA_ERROR_CODES[code as keyof typeof MASTRA_ERROR_CODES].status).toBe(status);
    });
  });

  describe('isMastraErrorCode', () => {
    it('accepts catalogue codes', () => {
      expect(isMastraErrorCode('AGENT_NOT_FOUND')).toBe(true);
    });

    it('rejects unknown values and non-strings', () => {
      expect(isMastraErrorCode('DURABLE_AGENT_RUN_ACTIVE')).toBe(false);
      expect(isMastraErrorCode('toString')).toBe(false);
      expect(isMastraErrorCode(undefined)).toBe(false);
      expect(isMastraErrorCode(404)).toBe(false);
    });
  });
});
