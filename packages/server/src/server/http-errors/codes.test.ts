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

    it.each(entries)('%s is a plain string equal to its key, so a frontend can switch on it', (key, value) => {
      expect(typeof value).toBe('string');
      expect(value).toBe(key);
    });
  });

  describe('given the HTTP status already conveys the generic category', () => {
    it('does not define codes that merely restate an HTTP status', () => {
      for (const generic of GENERIC_HTTP_STATUS_NAMES) {
        expect(Object.keys(MASTRA_ERROR_CODES)).not.toContain(generic);
      }
    });
  });

  describe('given the business codes a frontend relies on', () => {
    it('exposes exactly the expected codes', () => {
      expect(Object.keys(MASTRA_ERROR_CODES).sort()).toEqual(
        [
          'AGENT_NOT_FOUND',
          'MODEL_NOT_ALLOWED',
          'NO_MODEL_SELECTED',
          'WORKFLOW_NOT_FOUND',
          'WORKFLOW_RUN_NOT_FOUND',
          'WORKFLOW_RUN_ACCESS_DENIED',
          'WORKFLOW_SCHEMA_VALIDATION_FAILED',
          'WORKFLOW_RESUME_ALREADY_CLAIMED',
          'RUN_ID_REQUIRED',
          'DURABLE_RUN_ACTIVE',
          'DURABLE_RUN_RECOVERY_IN_PROGRESS',
          'DURABLE_RUN_SUSPENDED',
          'DURABLE_RUN_EXECUTION_CONFLICT',
          'DURABLE_RUN_ACCESS_DENIED',
          'THREAD_NOT_FOUND',
          'THREAD_ACCESS_DENIED',
          'TOOL_NOT_FOUND',
          'PROCESSOR_NOT_FOUND',
          'WORKSPACE_NOT_FOUND',
          'SCHEDULE_NOT_FOUND',
          'BACKGROUND_TASK_NOT_FOUND',
          'PLAN_CAPABILITY_NOT_FOUND',
          'STORAGE_NOT_CONFIGURED',
          'STORAGE_DOMAIN_UNAVAILABLE',
          'OBSERVABILITY_FEATURE_NOT_IMPLEMENTED',
          'FEEDBACK_REVIEW_STATUS_CONFLICT',
          'INVALID_REQUEST_BODY',
          'INVALID_QUERY_PARAMS',
          'INVALID_PATH_PARAMS',
        ].sort(),
      );
    });
  });

  describe('isMastraErrorCode', () => {
    it('accepts catalogue codes', () => {
      expect(isMastraErrorCode(MASTRA_ERROR_CODES.AGENT_NOT_FOUND)).toBe(true);
    });

    it('rejects unknown values and non-strings', () => {
      expect(isMastraErrorCode('DURABLE_AGENT_RUN_ACTIVE')).toBe(false);
      expect(isMastraErrorCode('toString')).toBe(false);
      expect(isMastraErrorCode(undefined)).toBe(false);
      expect(isMastraErrorCode(404)).toBe(false);
    });
  });
});
