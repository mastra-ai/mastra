import { describe, expect, it } from 'vitest';

import { schemaToJsonSchema } from '../server-adapter/openapi-utils';
import { conversationItemsListSchema, conversationObjectSchema } from './conversations';

describe('conversation schemas', () => {
  it('keeps the composed thread property in the conversation JSON schema', () => {
    const jsonSchema = schemaToJsonSchema(conversationObjectSchema);

    expect(Object.keys(jsonSchema.properties ?? {})).toEqual(['id', 'object', 'thread']);
    expect(jsonSchema.required).toContain('thread');
  });

  it('converts the conversation items list with its composed item schema', () => {
    const jsonSchema = schemaToJsonSchema(conversationItemsListSchema);

    expect(jsonSchema.properties?.data).toMatchObject({ type: 'array', items: expect.any(Object) });
  });
});
