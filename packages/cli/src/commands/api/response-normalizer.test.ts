import { describe, expect, it } from 'vitest';
import { normalizeResponse } from './response-normalizer.js';

describe('normalizeResponse', () => {
  it('compacts schema-looking fields without touching ordinary JSON strings', () => {
    expect(
      normalizeResponse({
        inputSchema:
          '{"$schema":"http://json-schema.org/draft-07/schema#","type":"object","properties":{"city":{"type":"string"}}}',
        outputSchema: { json: { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object' } },
        text: '{"not":"schema"}',
        data: { $schema: 'normal-payload-value', value: true },
      }),
    ).toEqual({
      inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
      outputSchema: { type: 'object' },
      text: '{"not":"schema"}',
      data: { $schema: 'normal-payload-value', value: true },
    });
  });

  it('normalizes nested schema fields in arrays', () => {
    expect(
      normalizeResponse([
        {
          id: 'weather-agent',
          tools: [{ parameters: { json: { $schema: 'draft', type: 'object' } } }],
        },
      ]),
    ).toEqual([{ id: 'weather-agent', tools: [{ parameters: { type: 'object' } }] }]);
  });
});
