import { describe, expect, it } from 'vitest';

import { normalizeResponse } from './response-normalizer.js';

describe('normalizeResponse', () => {
  it('parses schema-like JSON strings anywhere in a response and removes $schema metadata', () => {
    const schema = JSON.stringify({
      json: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: { location: { type: 'string' } },
      },
    });

    expect(
      normalizeResponse({
        agents: {
          weather: {
            inputSchema: schema,
            nested: [{ outputSchema: schema }],
          },
        },
      }),
    ).toEqual({
      agents: {
        weather: {
          inputSchema: { type: 'object', properties: { location: { type: 'string' } } },
          nested: [{ outputSchema: { type: 'object', properties: { location: { type: 'string' } } } }],
        },
      },
    });
  });

  it('leaves non-schema strings unchanged', () => {
    expect(normalizeResponse({ id: 'tool', description: '{"not":"schema"}' })).toEqual({
      id: 'tool',
      description: '{"not":"schema"}',
    });
  });
});
