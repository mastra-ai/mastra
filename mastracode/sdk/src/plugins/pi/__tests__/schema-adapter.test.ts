import { Type } from 'typebox';
import { describe, expect, it } from 'vitest';

import { adaptPiTypeBoxSchema, validatePiToolArguments } from '../schema-adapter.js';

describe('Pi TypeBox schema adapter', () => {
  it('preserves nested unions, optional fields, arrays, and descriptions', async () => {
    const schema = adaptPiTypeBoxSchema(
      Type.Object(
        {
          mode: Type.Union([Type.Literal('fast'), Type.Literal('safe')], { description: 'Execution mode' }),
          items: Type.Array(
            Type.Object({
              name: Type.String({ description: 'Item name' }),
              count: Type.Optional(Type.Integer({ minimum: 1 })),
            }),
          ),
        },
        { additionalProperties: false, description: 'Tool input' },
      ),
      'nested',
    );

    await expect(
      validatePiToolArguments(schema, { mode: 'safe', items: [{ name: 'one' }, { name: 'two', count: 2 }] }, 'nested'),
    ).resolves.toEqual({ mode: 'safe', items: [{ name: 'one' }, { name: 'two', count: 2 }] });
    await expect(validatePiToolArguments(schema, { mode: 'other', items: [] }, 'nested')).rejects.toThrow(
      'Pi tool "nested" received invalid arguments',
    );

    const jsonSchema = schema['~standard'].jsonSchema.input({ target: 'draft-07' });
    expect(jsonSchema).toMatchObject({
      description: 'Tool input',
      properties: {
        mode: { description: 'Execution mode' },
        items: { type: 'array' },
      },
    });
  });

  it('rejects missing and non-object schemas before publication', () => {
    expect(() => adaptPiTypeBoxSchema(undefined, 'missing')).toThrow(
      'Pi tool "missing" parameters must be a TypeBox schema object',
    );
    expect(() => adaptPiTypeBoxSchema('string', 'invalid')).toThrow(
      'Pi tool "invalid" parameters must be a TypeBox schema object',
    );
  });
});
