import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const fixture = fileURLToPath(new URL('./__fixtures__/typed-client/consumer.ts', import.meta.url));

export function compileConsumer(rootNames: string[]) {
  return spawnSync(
    process.execPath,
    [
      resolve(dirname(require.resolve('typescript/package.json')), require('typescript/package.json').bin.tsc),
      '--ignoreConfig',
      '--strict',
      '--noEmit',
      '--skipLibCheck',
      '--types',
      'node',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--esModuleInterop',
      '--pretty',
      'false',
      ...rootNames,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );
}

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
