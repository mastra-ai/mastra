import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const packageRoot = fileURLToPath(new URL('../..', import.meta.url));

async function checkConsumer(withSdk: boolean, module: 'NodeNext' | 'ESNext') {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-mcp-types-'));
  try {
    await mkdir(join(directory, 'node_modules'), { recursive: true });
    await symlink(dirname(require.resolve('zod/package.json')), join(directory, 'node_modules/zod'), 'junction');
    await writeFile(join(directory, 'mcp-types.d.ts'), await readFile(join(packageRoot, 'dist/tools/mcp-types.d.ts')));
    await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
    if (withSdk) {
      await mkdir(join(directory, 'node_modules/@types'));
      await symlink(
        dirname(require.resolve('@types/node/package.json')),
        join(directory, 'node_modules/@types/node'),
        'junction',
      );
      await mkdir(join(directory, 'node_modules/@modelcontextprotocol'));
      await symlink(
        await realpath(join(packageRoot, 'node_modules/@modelcontextprotocol/server')),
        join(directory, 'node_modules/@modelcontextprotocol/server'),
        'junction',
      );
    }
    const entry = join(directory, 'consumer.ts');
    await writeFile(
      entry,
      `import type { ServerContext, ElicitRequest, ElicitResult } from './mcp-types.js';
       declare const context: ServerContext;
       const signal: AbortSignal = context.mcpReq.signal;
       context.mcpReq.notify({ method: 'notifications/message', params: { level: 'info', data: 'hello' } });
       const request: ElicitRequest['params'] = {
         message: 'Name?', requestedSchema: { type: 'object', properties: { name: { type: 'string' } } }
       };
       const result: ElicitResult = { action: 'accept', content: { name: 'Ada' } };
       // @ts-expect-error Elicitation actions must retain their literal union.
       const invalidResult: ElicitResult = { action: 'invalid' };
       // @ts-expect-error The request message remains required.
       const invalidRequest: ElicitRequest['params'] = {};
       ${
         withSdk
           ? `import type { ServerContext as OriginalContext, ElicitRequest as OriginalRequest, ElicitResult as OriginalResult } from '@modelcontextprotocol/server';
              type Assert<T extends true> = T;
              type ContextForward = Assert<ServerContext extends OriginalContext ? true : false>;
              type ContextBackward = Assert<OriginalContext extends ServerContext ? true : false>;
              type RequestForward = Assert<ElicitRequest extends OriginalRequest ? true : false>;
              type RequestBackward = Assert<OriginalRequest extends ElicitRequest ? true : false>;
              type ResultForward = Assert<ElicitResult extends OriginalResult ? true : false>;
              type ResultBackward = Assert<OriginalResult extends ElicitResult ? true : false>;`
           : ''
       }`,
    );
    await writeFile(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          noEmit: true,
          strict: true,
          exactOptionalPropertyTypes: true,
          skipLibCheck: false,
          target: 'ES2023',
          module,
          moduleResolution: module === 'NodeNext' ? 'NodeNext' : 'Bundler',
          types: withSdk ? ['node'] : [],
        },
        files: ['consumer.ts'],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [join(dirname(require.resolve('typescript/package.json')), 'bin/tsc'), '-p', directory],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 25_000,
      },
    );
    expect(result.stdout + result.stderr).toBe('');
    expect(result.status).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('published MCP types (requires build:core)', () => {
  it('ships structural declarations without a production MCP SDK dependency', async () => {
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
    expect(manifest.dependencies).not.toHaveProperty('@modelcontextprotocol/server');
    expect(manifest.devDependencies).toHaveProperty('@modelcontextprotocol/server');
    const declarations = await readFile(join(packageRoot, 'dist/tools/mcp-types.d.ts'), 'utf8');
    expect(declarations).not.toMatch(/from ['"]@modelcontextprotocol\//);
    expect(declarations).not.toMatch(/\bdeclare class\b|\bunique symbol\b/);
    const tools = await readFile(join(packageRoot, 'dist/tools/types.d.ts'), 'utf8');
    expect(tools).toContain("from './mcp-types.js'");
    expect(await readFile(join(packageRoot, 'dist/tools/mcp-types.LICENSE'), 'utf8')).toBe(
      await readFile(join(packageRoot, 'node_modules/@modelcontextprotocol/server/LICENSE'), 'utf8'),
    );
  });

  it.each(['NodeNext', 'ESNext'] as const)(
    'resolves without the SDK (module %s)',
    async module => {
      await checkConsumer(false, module);
    },
    30_000,
  );

  it('remains assignable in both directions with the actual SDK', async () => {
    await checkConsumer(true, 'NodeNext');
  }, 30_000);
});
