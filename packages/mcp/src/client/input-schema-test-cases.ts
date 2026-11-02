/** Input schemas both the cf-worker validator and the structural fallback must reject. */
export const MALFORMED_INPUT_SCHEMAS: [string, unknown][] = [
  [
    'required list nested under properties',
    { type: 'object', properties: { coin: { type: 'string' }, required: ['coin'] } },
  ],
  ['boolean root', true],
  ['array root', [{ type: 'string' }]],
  ['deeply nested non-schema', { type: 'object', properties: { a: { type: 'object', properties: { b: 'string' } } } }],
  ['required with non-strings', { type: 'object', required: ['a', 1] }],
  ['unknown type name', { type: 'object', properties: { a: { type: 'text' } } }],
  ['enum that is not an array', { type: 'object', properties: { a: { enum: 'x' } } }],
  ['empty anyOf', { type: 'object', properties: { a: { anyOf: [] } } }],
  ['properties that is not an object', { type: 'object', properties: [] }],
  ['non-schema $defs entry', { type: 'object', $defs: { A: ['not-a-schema'] } }],
  ['non-array prefixItems', { type: 'object', properties: { a: { prefixItems: 'x' } } }],
  ['non-schema behind a jsonSchema wrapper', { jsonSchema: { type: 'object', properties: { a: 1 } } }],
  ['string minimum', { type: 'object', properties: { a: { type: 'number', minimum: '5' } } }],
  ['negative maxLength', { type: 'object', properties: { a: { type: 'string', maxLength: -1 } } }],
  ['zero multipleOf', { type: 'object', properties: { a: { type: 'number', multipleOf: 0 } } }],
  ['non-string pattern', { type: 'object', properties: { a: { type: 'string', pattern: 5 } } }],
  ['non-boolean uniqueItems', { type: 'object', properties: { a: { type: 'array', uniqueItems: 'yes' } } }],
  ['non-array dependentRequired entry', { type: 'object', dependentRequired: { a: 'b' } }],
  ['empty tuple items', { type: 'object', properties: { a: { type: 'array', items: [] } } }],
];

/** Input schemas both the cf-worker validator and the structural fallback must accept. */
export const VALID_INPUT_SCHEMAS: [string, unknown][] = [
  ['a property named required', { type: 'object', properties: { required: { type: 'boolean' } } }],
  ['boolean subschemas', { type: 'object', properties: { a: true }, additionalProperties: false }],
  ['draft-07 tuple items', { type: 'object', properties: { a: { type: 'array', items: [{ type: 'string' }] } } }],
  ['draft-07 property dependencies', { type: 'object', dependencies: { a: ['b'], c: { required: ['d'] } } }],
  ['nullable type arrays', { type: 'object', properties: { a: { type: ['string', 'null'] } } }],
  ['refs into $defs', { type: 'object', properties: { a: { $ref: '#/$defs/A' } }, $defs: { A: { type: 'string' } } }],
  ['unknown extension keywords', { type: 'object', 'x-vendor': ['anything'], properties: {} }],
  ['a declared 2020-12 dialect', { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' }],
  ['duplicate required entries', { type: 'object', properties: { a: { type: 'string' } }, required: ['a', 'a'] }],
  ['duplicate and empty enums', { type: 'object', properties: { a: { enum: ['x', 'x'] }, b: { enum: [] } } }],
  ['a Python-style pattern', { type: 'object', properties: { a: { type: 'string', pattern: '^(?P<x>\\d+)$' } } }],
  ['a non-URI $id', { $id: 'my tool schema', type: 'object' }],
  [
    'numeric and length limits',
    {
      type: 'object',
      properties: { a: { type: 'number', minimum: 0, exclusiveMaximum: 1.5, multipleOf: 0.5 } },
      dependentRequired: { a: ['b'] },
      minProperties: 0,
    },
  ],
];
