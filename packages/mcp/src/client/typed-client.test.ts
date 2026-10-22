import { readFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileStrict } from './__fixtures__/typed-client/compile';

const fixture = fileURLToPath(new URL('./__fixtures__/typed-client/consumer.ts', import.meta.url));

/** Writes a temporary copy beside the fixture so its relative imports still resolve. */
function compileFixture(source: string, name: string) {
  const path = fixture.replace('consumer.ts', `${name}-${process.pid}.ts`);
  try {
    return compileStrict(source, path);
  } finally {
    unlinkSync(path);
  }
}

describe('typed MCP client consumer', () => {
  it('compiles the documented direct-call example', () => {
    const docs = readFileSync(
      new URL('../../../../docs/src/content/en/reference/tools/mcp-client.mdx', import.meta.url),
      'utf8',
    );
    const section = docs.split('### Typed client contracts')[1]?.split('### Generate client types')[0];
    const source = section?.match(/```typescript\n([\s\S]*?)```/)?.[1];
    expect(source).toBeDefined();
    const { strict } = compileFixture(source!.replace("'@mastra/mcp'", "'../../../index'"), 'docs');
    expect(strict.stdout + strict.stderr).toBe('');
    expect(strict.status).toBe(0);
  }, 60_000);

  it('checks exact partial keys, direct calls, result alternatives and agent compatibility', () => {
    const source = readFileSync(fixture, 'utf8');
    const { strict, negative, directives } = compileFixture(source, 'strict');
    expect(strict.error).toBeUndefined();
    expect(strict.stdout + strict.stderr).toBe('');
    expect(strict.status).toBe(0);
    // The negative pass proves the same fixture actually fails without its expect-error directives.
    expect(negative!.status).toBe(1);
    expect(negative!.stdout.match(/error TS/g)?.length).toBeGreaterThanOrEqual(directives);
  }, 60_000);
});
