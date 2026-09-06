import { describe, expect, it } from 'vitest';

import { parseWorkflowCatalogSchema } from './workflow-catalog-schema';

describe('parseWorkflowCatalogSchema', () => {
  describe('when the catalog schema uses the serialized JSON envelope', () => {
    it('returns the enclosed JSON Schema', () => {
      expect(
        parseWorkflowCatalogSchema(
          JSON.stringify({
            json: {
              type: 'object',
              properties: { email: { type: 'string' } },
              required: ['email'],
            },
          }),
        ),
      ).toEqual({
        type: 'object',
        properties: { email: { type: 'string' } },
        required: ['email'],
      });
    });
  });

  describe('when the catalog schema is already a JSON Schema', () => {
    it('returns the parsed schema unchanged', () => {
      expect(parseWorkflowCatalogSchema(JSON.stringify({ type: 'string' }))).toEqual({ type: 'string' });
    });
  });

  describe('when the catalog schema cannot be interpreted', () => {
    it('returns undefined', () => {
      expect(parseWorkflowCatalogSchema('{')).toBeUndefined();
    });
  });
});
