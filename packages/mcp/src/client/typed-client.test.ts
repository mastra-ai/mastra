import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileConsumer } from './__fixtures__/typed-client/compile';

const fixture = fileURLToPath(new URL('./__fixtures__/typed-client/consumer.ts', import.meta.url));

describe('typed MCP client consumer', () => {
  it('compiles the documented direct-call example', () => {
    const docs = readFileSync(
      new URL('../../../../docs/src/content/en/reference/tools/mcp-client.mdx', import.meta.url),
      'utf8',
    );
    const section = docs.split('### Typed client contracts')[1]?.split('### `MastraMCPServerDefinition`')[0];
    const source = section?.match(/```typescript\n([\s\S]*?)```/)?.[1];
    expect(source).toBeDefined();
    const path = fixture.replace('consumer.ts', `docs-${process.pid}.ts`);
    try {
      writeFileSync(path, source!.replace("'@mastra/mcp'", "'../../../index'"));
      const result = compileConsumer([path]);
      expect(result.stdout + result.stderr).toBe('');
      expect(result.status).toBe(0);
    } finally {
      unlinkSync(path);
    }
  }, 60_000);

  it('checks exact partial keys, direct calls, result alternatives and agent compatibility', () => {
    const result = compileConsumer([fixture]);
    expect(result.error).toBeUndefined();
    expect(result.stdout + result.stderr).toBe('');
    expect(result.status).toBe(0);
  }, 60_000);

  it('actually reports the negative cases when expect-error directives are removed', () => {
    const source = readFileSync(fixture, 'utf8');
    const directives = source.match(/@ts-expect-error/g) ?? [];
    const negative = fixture.replace('consumer.ts', `negative-${process.pid}.ts`);
    try {
      writeFileSync(negative, source.replace(/@ts-expect-error/g, 'negative-case'));
      const result = compileConsumer([negative]);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      const errors = result.stdout.split('\n').filter(line => line.includes(`negative-${process.pid}.ts(`));
      expect(errors.length).toBeGreaterThanOrEqual(directives.length);
    } finally {
      unlinkSync(negative);
    }
  }, 60_000);
});
