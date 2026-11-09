import { describe, expect, it } from 'vitest';
import { describeSchemaType, getSchemaFields, isEmptySchema } from './get-schema-fields';

describe('getSchemaFields', () => {
  describe('when the schema is an object with properties', () => {
    it('lists each property with its type, requiredness, description and default', () => {
      const fields = getSchemaFields({
        type: 'object',
        properties: {
          ingredient: { type: 'string', description: 'What to cook' },
          servings: { type: 'number', default: 2 },
        },
        required: ['ingredient'],
      });

      expect(fields).toEqual([
        { name: 'ingredient', type: 'string', required: true, description: 'What to cook', defaultValue: undefined },
        { name: 'servings', type: 'number', required: false, description: undefined, defaultValue: '2' },
      ]);
    });
  });

  describe('when a required field has a default', () => {
    const schema = {
      type: 'object',
      properties: { userId: { type: 'string', default: 'default-user-id' } },
      required: ['userId'],
    };

    it('treats the field as optional for a schema the caller fills in', () => {
      const [field] = getSchemaFields(schema, { defaultsAreOptional: true });

      expect(field?.required).toBe(false);
    });

    it('keeps the field required for an output schema', () => {
      const [field] = getSchemaFields(schema);

      expect(field?.required).toBe(true);
    });
  });

  describe('when the schema is not an object', () => {
    it('returns no fields', () => {
      expect(getSchemaFields({ type: 'string' })).toEqual([]);
    });
  });
});

describe('describeSchemaType', () => {
  describe('when the schema is an array', () => {
    it('describes the item type', () => {
      expect(describeSchemaType({ type: 'array', items: { type: 'string' } })).toBe('string[]');
    });
  });

  describe('when the schema is an enum', () => {
    it('lists the allowed values', () => {
      expect(describeSchemaType({ type: 'string', enum: ['mild', 'hot'] })).toBe('"mild" | "hot"');
    });
  });

  describe('when the schema is a dictionary', () => {
    it('describes the entry type', () => {
      expect(describeSchemaType({ type: 'object', additionalProperties: { type: 'string' } })).toBe(
        'Record<string, string>',
      );
    });
  });

  describe('when the schema is a union', () => {
    it('joins the variant types', () => {
      expect(describeSchemaType({ anyOf: [{ type: 'string' }, { type: 'null' }] })).toBe('string | null');
    });
  });
});

describe('isEmptySchema', () => {
  describe('when the schema only carries a $schema dialect', () => {
    it('is empty', () => {
      expect(isEmptySchema({ $schema: 'https://json-schema.org/draft/2020-12/schema' })).toBe(true);
    });
  });

  describe('when the schema declares a type', () => {
    it('is not empty', () => {
      expect(isEmptySchema({ type: 'string' })).toBe(false);
    });
  });
});
