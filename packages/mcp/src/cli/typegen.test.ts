import fs, { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';
import { describe, expect, it, vi } from 'vitest';
import { compileConsumer } from '../client/__fixtures__/typed-client/compile';
import type { SerializableMCPToolCatalog } from '../client/types';
import { generateToolTypes } from './typegen';

vi.mock('json-schema-to-typescript', async importOriginal => {
  const original = await importOriginal<typeof import('json-schema-to-typescript')>();
  return { ...original, compile: vi.fn(original.compile) };
});

const fixtureDir = fileURLToPath(new URL('../client/__fixtures__/typed-client/', import.meta.url));
function catalog(inputSchema: unknown, outputSchema?: unknown): SerializableMCPToolCatalog {
  return { test: { tool: { name: 'tool', inputSchema, outputSchema } } };
}

function check(source: string, consumer = '') {
  const dir = mkdtempSync(join(fixtureDir, 'generated-'));
  try {
    const file = join(dir, 'contracts.ts');
    writeFileSync(file, source + '\n' + consumer);
    const result = compileConsumer([file]);
    expect(result.error).toBeUndefined();
    expect(result.stdout + result.stderr).toBe('');
    expect(result.status).toBe(0);
    const count = consumer.match(/@ts-expect-error/g)?.length ?? 0;
    if (count) {
      writeFileSync(file, (source + '\n' + consumer).replace(/@ts-expect-error/g, 'negative-case'));
      const negative = compileConsumer([file]);
      expect(negative.status).toBe(1);
      expect(negative.stdout.match(/error TS/g)?.length).toBeGreaterThanOrEqual(count);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const assertions = `
type Input = MCPServers['test']['tools']['tool']['input'];
type Output = MCPServers['test']['tools']['tool']['output'];
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
`;

describe('concrete MCP schema generation', () => {
  it.each(['reference/tools/mcp-client.mdx', 'docs/connections/mcp.mdx'])(
    'compiles generated types with the actual %s examples',
    async page => {
      const docs = readFileSync(new URL(`../../../../docs/src/content/en/${page}`, import.meta.url), 'utf8');
      const config = docs.match(/```typescript title="src\/mcp\/client.ts"\n([\s\S]*?)```/)?.[1];
      const call = docs.match(/```typescript title="src\/mcp\/call-weather.ts"\n([\s\S]*?)```/)?.[1];
      expect(config).toBeDefined();
      expect(call).toBeDefined();
      const generated = await generateToolTypes({
        weather: {
          get_weather: {
            name: 'get_weather',
            inputSchema: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
              additionalProperties: false,
            },
            outputSchema: {
              type: 'object',
              properties: { temperature: { type: 'number' } },
              required: ['temperature'],
              additionalProperties: false,
            },
          },
        },
      });
      const dir = mkdtempSync(join(fixtureDir, 'docs-generated-'));
      try {
        writeFileSync(join(dir, 'mcp-types.generated.ts'), generated.source);
        writeFileSync(join(dir, 'client.ts'), config!.replace("'@mastra/mcp'", "'../../../../index'"));
        const file = join(dir, 'call.ts');
        writeFileSync(file, call!);
        const result = compileConsumer([file]);
        expect(result.stdout + result.stderr).toBe('');
        expect(result.status).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it('reuses the complete Wave 1 direct-call contract with generated interfaces', async () => {
    const shape = (properties: Record<string, unknown>, required: string[] = Object.keys(properties)) => ({
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    });
    const { source, warnings } = await generateToolTypes({
      weather: {
        get_weather: {
          name: 'get_weather',
          inputSchema: shape({ location: { type: 'string' } }),
          outputSchema: shape({ temperature: { type: 'number' }, conditions: { type: 'string' } }),
        },
        ping: { name: 'ping', inputSchema: shape({ message: { type: 'string' } }, []) },
      },
      stocks: {
        quote: {
          name: 'quote',
          inputSchema: shape({ symbol: { type: 'string' } }),
          outputSchema: shape({ price: { type: 'number' } }),
        },
      },
    });
    expect(warnings).toEqual([]);
    const consumer = readFileSync(join(fixtureDir, 'consumer.ts'), 'utf8')
      .replace("import type { MCPServers } from './contracts';", '')
      .replaceAll("from '../../../index'", "from '../../../../index'");
    check(source, consumer);
  });

  it.each([
    [{ type: 'string' }, `type A = Assert<Equal<Input,string>>;`],
    [{ enum: ['yes', 'no', null] }, `type A = Assert<Equal<Input,'yes'|'no'|null>>;`],
    [{ const: 'fixed' }, `type A = Assert<Equal<Input,'fixed'>>;`],
    [{ type: ['string', 'null'] }, `type A = Assert<Equal<Input,string|null>>;`],
    [
      { type: 'array', items: { type: 'number' } },
      `const ok: Input = [1,2];\n// @ts-expect-error wrong item\nconst bad: Input = ['a'];`,
    ],
    [
      { type: 'array', items: [{ type: 'string' }, { type: 'number' }], minItems: 2, maxItems: 2 },
      `const ok: Input = ['a',1];\n// @ts-expect-error positional order\nconst bad: Input = [1,'a'];`,
    ],
    [{ anyOf: [{ type: 'string' }, { type: 'number' }] }, `type A = Assert<Equal<Input,string|number>>;`],
    [{ oneOf: [{ type: 'boolean' }, { type: 'null' }] }, `type A = Assert<Equal<Input,boolean|null>>;`],
    [
      {
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
        ],
      },
      `const ok: Input = {a:'a',b:1};\n// @ts-expect-error missing intersection property\nconst bad: Input = {a:'a'};`,
    ],
    [true, `type A = Assert<Equal<Input,unknown>>;`],
    [false, `type A = Assert<Equal<Input,never>>;`],
  ])('strictly compiles schema %#', async (schema, usage) => {
    const result = await generateToolTypes(catalog(schema));
    expect(result.warnings).toEqual([]);
    check(result.source, assertions + usage + '\ntype MissingOutput = Assert<Equal<Output,unknown>>;');
  });

  it.each([true, false, undefined, { type: 'number' }])(
    'preserves additionalProperties %j',
    async additionalProperties => {
      const schema = { type: 'object', ...(additionalProperties === undefined ? {} : { additionalProperties }) };
      const result = await generateToolTypes(catalog(schema));
      check(
        result.source,
        assertions +
          (additionalProperties === false
            ? `type Keys = Assert<Equal<keyof Input,never>>;`
            : `const ok: Input = {extra: 1};\n` +
              (typeof additionalProperties === 'object'
                ? `// @ts-expect-error extra values are numeric\nconst bad: Input = {extra:'x'};`
                : `type NotAny = Assert<Equal<IsAny<Input['extra']>,false>>;`)),
      );
    },
  );

  it('isolates root and repeated nested titles, raw tool names and hostile comments', async () => {
    const schema = {
      title: 'WrongRoot',
      description: '*/ export const injected = 1; /*',
      type: 'object',
      properties: { payload: { title: 'Payload', type: 'string' }, 'quoted"\nkey': { type: 'number' } },
      required: ['payload'],
      additionalProperties: false,
    };
    const result = await generateToolTypes({
      ['__proto__']: {
        'get-value': { name: 'get-value', inputSchema: schema },
        get_value: {
          name: 'get_value',
          inputSchema: { ...schema, properties: { payload: { title: 'Payload', type: 'number' } } },
        },
        ['constructor']: { name: 'constructor', inputSchema: true },
      },
      '☁': { default: { name: 'default', inputSchema: schema } },
    });
    expect(result.source).not.toMatch(/WrongRoot|Payload|injected/);
    check(
      result.source,
      `type A = MCPServers['__proto__']['tools']['get-value']['input'];\nconst a: A = {payload:'x'};\n// @ts-expect-error distinct same-normalized tool\nconst b: MCPServers['__proto__']['tools']['get_value']['input'] = a;`,
    );
  });

  it.each(['definitions', '$defs'])('preserves escaped %s local references and recursion', async key => {
    const result = await generateToolTypes(
      catalog({
        type: 'object',
        properties: { value: { $ref: `#/${key}/a~1b~0c` }, next: { $ref: '#' } },
        required: ['value'],
        additionalProperties: false,
        [key]: { 'a/b~c': { type: 'string' } },
      }),
    );
    check(
      result.source,
      assertions +
        `const ok: Input = {value:'a',next:{value:'b'}};\n// @ts-expect-error resolved string\nconst bad: Input = {value:1};`,
    );
  });

  it('is byte-identical for reordered catalogs and deep schema maps without mutation', async () => {
    const input = catalog({
      type: 'object',
      properties: { z: { type: 'number' }, a: { type: 'string' } },
      definitions: { z: { type: 'number' }, a: { type: 'string' } },
      required: ['z', 'a'],
    });
    const reverse = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reverse)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([key, child]) => [key, reverse(child)]),
            )
          : value;
    input.other = { ...input.test };
    input.test!.second = { name: 'second', inputSchema: true };
    const before = JSON.stringify(input);
    const first = await generateToolTypes(input);
    const second = await generateToolTypes(reverse(input) as SerializableMCPToolCatalog);
    expect(first).toEqual(second);
    expect(JSON.stringify(input)).toBe(before);
    check(first.source);
  });

  it('preserves base types for runtime-only validation constraints without emitting their text', async () => {
    const result = await generateToolTypes(
      catalog({
        type: 'object',
        minProperties: 1,
        maxProperties: 4,
        properties: {
          text: { type: 'string', format: 'SECRET */ injected', pattern: 'SECRET', minLength: 1, maxLength: 20 },
          number: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            exclusiveMinimum: -1,
            exclusiveMaximum: 11,
            multipleOf: 0.5,
          },
          array: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        required: ['text', 'number', 'array'],
        additionalProperties: false,
      }),
    );
    expect(result.warnings).toEqual([]);
    expect(result.source).not.toMatch(/SECRET|injected/);
    check(
      result.source,
      assertions +
        `
      type Text = Assert<Equal<Input['text'],string>>;
      type Number = Assert<Equal<Input['number'],number>>;
      type Array = Assert<Equal<Input['array'],string[]>>;
    `,
    );
  });

  it('warns and widens modern tuples rather than silently dropping prefixItems', async () => {
    const result = await generateToolTypes(catalog({ type: 'array', prefixItems: [{ type: 'string' }], items: false }));
    expect(result.warnings).toHaveLength(1);
    check(result.source, assertions + 'type Tuple = Assert<Equal<Input,unknown>>;');
  });

  it('widens only unsupported portions, never trusting custom TypeScript', async () => {
    const result = await generateToolTypes(
      catalog({
        type: 'object',
        properties: {
          good: { type: 'string' },
          bad: { tsType: 'any; export const injected = 1', type: 'string' },
          conditional: { if: { type: 'string' }, then: { const: 'a' } },
        },
        required: ['good', 'bad', 'conditional'],
        additionalProperties: false,
      }),
    );
    expect(result.warnings).toHaveLength(2);
    expect(result.source).not.toContain('injected');
    check(
      result.source,
      assertions +
        `type A = Assert<Equal<Input['bad'],unknown>>; type B = Assert<Equal<Input['good'],string>>; type C = Assert<Equal<IsAny<Input['conditional']>,false>>;`,
    );
  });

  it.each(['https://127.0.0.1:1/SECRET.json', 'file:///SECRET.json', './SECRET.json'])(
    'does not resolve external reference %s',
    async ref => {
      const result = await generateToolTypes(catalog({ $ref: ref }));
      expect(result.warnings).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain('SECRET');
      check(result.source, assertions + 'type A = Assert<Equal<Input,unknown>>;');
    },
  );

  it.each([
    null,
    [],
    { type: 'INVALID' },
    { properties: [] },
    { required: [1] },
    { items: 1 },
    { enum: [] },
    { minItems: -1 },
    { $ref: '#/missing' },
    { $ref: '#' },
    { definitions: { x: { $ref: '#/definitions/y' }, y: { $ref: '#/definitions/x' } }, $ref: '#/definitions/x' },
  ])('rejects malformed or unresolved schema %#', async schema => {
    await expect(generateToolTypes(catalog(schema))).rejects.toThrow(/schema/i);
  });

  it('never reads reachable external files or servers and explicitly disables resolvers', async () => {
    let requests = 0;
    const server = createServer((_req, res) => {
      requests++;
      res.end('{"type":"string"}');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing server address');
    const dir = mkdtempSync(join(fixtureDir, 'external-'));
    const path = join(dir, 'schema.json');
    writeFileSync(path, '{"type":"string"}');
    const read = vi.spyOn(fs, 'readFile');
    const readAsync = vi.spyOn(fs.promises, 'readFile');
    try {
      for (const ref of [path, `http://127.0.0.1:${address.port}/schema.json`]) {
        const result = await generateToolTypes(catalog({ $ref: ref }));
        expect(result.warnings).toHaveLength(1);
        check(result.source, assertions + 'type A = Assert<Equal<Input,unknown>>;');
      }
      expect(requests).toBe(0);
      expect(read.mock.calls.some(args => String(args[0]) === path)).toBe(false);
      expect(readAsync.mock.calls.some(args => String(args[0]) === path)).toBe(false);
      expect(vi.mocked(compile).mock.lastCall?.[2]?.$refOptions).toEqual({
        resolve: { external: false, file: false, http: false },
      });
    } finally {
      read.mockRestore();
      readAsync.mockRestore();
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('propagates conversion failure with no source or secret-bearing diagnostics', async () => {
    vi.mocked(compile).mockRejectedValueOnce(new Error('SECRET converter detail'));
    await expect(generateToolTypes(catalog({ type: 'string' }))).rejects.toThrow(
      'Schema conversion failed at server[0]/tool[0]/input',
    );
    const result = await generateToolTypes(
      catalog({ type: 'object', properties: { SECRET: { unsupported: 'SECRET' } } }),
    );
    expect(result.warnings.join()).not.toContain('SECRET');
    check(result.source);
    await expect(
      generateToolTypes(catalog({ type: 'object', properties: { SECRET: { type: 'INVALID' } } })),
    ).rejects.toThrow(/^Invalid or unsupported recursive schema at server\[0\]\/tool\[0\]\/input\/schema\[1\]$/);
  });

  it.each([{ minimum: 'bad' }, { minLength: -1 }, { deprecated: 'yes' }, { description: 1 }, { examples: {} }])(
    'rejects malformed unsupported keywords %#',
    async schema => {
      await expect(generateToolTypes(catalog(schema))).rejects.toThrow(/schema/i);
    },
  );

  it.each(['allOf', 'anyOf', 'oneOf'])('rejects unguarded %s reference cycles', async keyword => {
    await expect(generateToolTypes(catalog({ [keyword]: [{ $ref: '#' }] }))).rejects.toThrow(/recursive schema/);
  });

  it('preserves guarded recursive arrays and mutually recursive objects', async () => {
    const array = await generateToolTypes(catalog({ type: 'array', items: { $ref: '#' } }));
    check(
      array.source,
      assertions +
        `const nested: Input = [[], [[]]];\n// @ts-expect-error leaves must be arrays\nconst bad: Input = [1];`,
    );
    const mutual = await generateToolTypes(
      catalog({
        $ref: '#/$defs/a',
        $defs: {
          a: { type: 'object', properties: { b: { $ref: '#/$defs/b' } }, additionalProperties: false },
          b: { type: 'object', properties: { a: { $ref: '#/$defs/a' } }, additionalProperties: false },
        },
      }),
    );
    check(
      mutual.source,
      assertions +
        `const nested: Input = {b:{a:{}}};\n// @ts-expect-error wrong recursive shape\nconst bad: Input = {b:{a:1}};`,
    );
  });

  it('rejects object cycles and bounds deeply nested input', async () => {
    const cycle: Record<string, unknown> = { type: 'object' };
    cycle.properties = { cycle };
    await expect(generateToolTypes(catalog(cycle))).rejects.toThrow(/schema/i);
    let deep: unknown = true;
    for (let i = 0; i < 130; i++) deep = { items: deep };
    await expect(generateToolTypes(catalog(deep))).rejects.toThrow(/schema/i);
  });

  it('rejects server identifier and flattened-tool collisions', async () => {
    const tool = { name: 'x', inputSchema: true };
    await expect(generateToolTypes({ 'get-value': {}, get_value: {} })).rejects.toThrow(/collision/);
    await expect(generateToolTypes({ a_b: { c: tool }, a: { b_c: tool } })).rejects.toThrow(/collision/);
  });

  it('supports empty catalogs and empty servers with exact keys', async () => {
    check(
      (await generateToolTypes({})).source,
      'type Empty = keyof MCPServers; const impossible: Empty = null as never;',
    );
    check(
      (await generateToolTypes({ empty: {} })).source,
      `type Tools = keyof MCPServers['empty']['tools']; const impossible: Tools = null as never;`,
    );
  });
});
