import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entry = fileURLToPath(new URL('./index.ts', import.meta.url));
const server = fileURLToPath(new URL('./__fixtures__/server.mjs', import.meta.url));
let directory: string;

function launch(args: string[], extraEnv: Record<string, string> = {}) {
  const child = spawn(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      '--import',
      new URL('./__fixtures__/filesystem-fault.mjs', import.meta.url).href,
      entry,
      ...args,
    ],
    {
      cwd: directory,
      env: { ...process.env, TSX_TSCONFIG_PATH: join(root, 'tsconfig.json'), NO_COLOR: '1', ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', chunk => (output += chunk));
  child.stderr.on('data', chunk => (output += chunk));
  const done = new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('CLI fixture timed out'));
    }, 20_000);
    child.once('error', reject);
    child.once('close', code => {
      clearTimeout(timeout);
      resolve({ code, output });
    });
  });
  return { child, done };
}

async function client(file = 'client.ts', output = 'generated.ts', servers = '{}', extra = '') {
  await writeFile(
    join(directory, file),
    `import {MCPClient} from '@mastra/mcp';
    import type {MCPServers} from './missing.generated.ts';
    export const client = new MCPClient({id:${JSON.stringify(file)}, servers:${servers}, typegen:{outFile:${JSON.stringify(output)}}});
    ${extra}`,
  );
}
function stdio() {
  return `{weather:{command:${JSON.stringify(process.execPath)},args:${JSON.stringify([server, 'stdio', join(directory, 'events'), '', join(directory, 'mode')])},timeout:200,discovery:{retry: {maxAttempts:1}}}}`;
}
async function events() {
  return (await readFile(join(directory, 'events'), 'utf8').catch(() => ''))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}
async function waitForEvent(event: string) {
  for (let i = 0; i < 200; i++) {
    if ((await events()).some(item => item.event === event)) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Missing fixture event ${event}`);
}

beforeEach(async () => {
  directory = await mkdtemp(join(root, '.typegen-test-'));
  await writeFile(join(directory, 'mode'), '');
});
afterEach(async () => {
  for (const event of await events()) {
    if (event.event === 'start') {
      try {
        process.kill(event.pid, 'SIGTERM');
      } catch {
        /* already closed */
      }
    }
  }
  await rm(directory, { recursive: true, force: true });
});

describe('client-file generation', () => {
  it.each([[], ['unknown'], ['generate'], ['generate', '--help'], ['generate', 'missing.ts']].map(args => ({ args })))(
    'rejects invalid arguments $args',
    async ({ args }) => {
      expect((await launch(args).done).code).not.toBe(0);
    },
  );

  it('generates before type-only imports exist, supports transitive TS, aliases, default exports and repeated inputs', async () => {
    await writeFile(join(directory, 'config.ts'), 'export const servers = {};');
    await client('client.ts', 'nested/generated.ts', 'servers', 'export default client;');
    const text = await readFile(join(directory, 'client.ts'), 'utf8');
    await writeFile(join(directory, 'client.ts'), `import {servers} from './config.ts';\n${text}`);
    await writeFile(join(directory, 'alias.ts'), "export {client as default} from './client.ts';");
    await symlink(join(directory, 'client.ts'), join(directory, 'link.ts'));
    const result = await launch(['generate', 'client.ts', 'alias.ts', 'link.ts', './client.ts']).done;
    expect(result, result.output).toMatchObject({ code: 0 });
    expect(result.output).toContain('Generated 1');
    expect(await readFile(join(directory, 'nested/generated.ts'), 'utf8')).toContain('export interface MCPServers');
  });

  it('lists real stdio schemas without executing tools, regenerates identical bytes and closes the child', async () => {
    await client('client.ts', 'generated.ts', stdio());
    const first = await launch(['generate', 'client.ts'], { VERBOSE: '1' }).done;
    expect(first, first.output).toMatchObject({ code: 0 });
    expect(first.output).not.toContain('SENTINEL');
    const source = await readFile(join(directory, 'generated.ts'), 'utf8');
    expect(source).toContain('celsius: ToolSchema2Value1');
    expect(source).toContain('export type ToolSchema2Value1 = number;');
    const second = await launch(['generate', 'client.ts']).done;
    expect(second.code, second.output).toBe(0);
    expect(await readFile(join(directory, 'generated.ts'), 'utf8')).toBe(source);
    const log = await events();
    expect(log.filter(item => item.event === 'call')).toHaveLength(0);
    expect(log.filter(item => item.event === 'exit')).toHaveLength(2);
  });

  it.each(['fail', 'invalid', 'stall'])('preserves all outputs and cleans up on %s', async mode => {
    await client('first.ts', 'first.generated.ts');
    await client('second.ts', 'second.generated.ts', stdio());
    await writeFile(join(directory, 'mode'), mode);
    for (const file of ['first.generated.ts', 'second.generated.ts']) await writeFile(join(directory, file), 'before');
    const result = await launch(['generate', 'first.ts', 'second.ts'], { VERBOSE: '1' }).done;
    expect(result.code).not.toBe(0);
    expect(result.output).not.toContain('SENTINEL');
    for (const file of ['first.generated.ts', 'second.generated.ts'])
      expect(await readFile(join(directory, file), 'utf8')).toBe('before');
    expect((await readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false);
    expect((await events()).some(item => item.event === 'exit')).toBe(true);
  });

  it('rejects canonical output collisions before discovering', async () => {
    await symlink(directory, join(directory, 'alias'));
    await client('first.ts', 'generated.ts', stdio());
    await client('second.ts', 'alias/generated.ts', stdio());
    expect((await launch(['generate', 'first.ts', 'second.ts']).done).code).not.toBe(0);
    expect(await events()).toHaveLength(0);
  });

  it('rejects output-over-input via symlink without changing the input', async () => {
    await client('client.ts', 'alias.ts');
    await symlink(join(directory, 'client.ts'), join(directory, 'alias.ts'));
    const before = await readFile(join(directory, 'client.ts'), 'utf8');
    expect((await launch(['generate', 'client.ts']).done).code).not.toBe(0);
    expect(await readFile(join(directory, 'client.ts'), 'utf8')).toBe(before);
  });

  it('does not invoke factories, inspect containers, or accept duck-typed clients', async () => {
    await writeFile(
      join(directory, 'client.ts'),
      `export default {typegen:{outFile:'bad.ts'},listToolDefinitionsWithErrors(){throw Error('factory called')}};
      export const factory = () => { throw Error('factory called') };`,
    );
    const result = await launch(['generate', 'client.ts']).done;
    expect(result.code).not.toBe(0);
    expect(result.output).not.toContain('factory called');
    expect(await readdir(directory)).not.toContain('bad.ts');
  });

  it('disconnects selected clients when later imports fail and attempts every cleanup after one rejects', async () => {
    await client(
      'first.ts',
      'first.generated.ts',
      '{}',
      `client.disconnect=async()=>{await import('node:fs/promises').then(fs=>fs.writeFile('first.closed','yes'));throw Error('SENTINEL_CLEANUP')};`,
    );
    await client(
      'second.ts',
      'second.generated.ts',
      '{}',
      `client.disconnect=async()=>{await import('node:fs/promises').then(fs=>fs.writeFile('second.closed','yes'))};`,
    );
    await writeFile(join(directory, 'bad.ts'), "throw Error('SENTINEL_IMPORT'); export {};");
    const result = await launch(['generate', 'first.ts', 'second.ts', 'bad.ts']).done;
    expect(result.code).not.toBe(0);
    expect(result.output).not.toContain('SENTINEL');
    for (const path of ['first.closed', 'second.closed'])
      expect(await readFile(join(directory, path), 'utf8')).toBe('yes');
  });

  it.each(['stage', 'rename', 'cleanup'])(
    'reports %s filesystem failures honestly and removes staged files where possible',
    async fault => {
      await client('first.ts', 'first.generated.ts');
      await client('second.ts', 'second.generated.ts');
      for (const name of ['first.generated.ts', 'second.generated.ts'])
        await writeFile(join(directory, name), 'before');
      const result = await launch(['generate', 'first.ts', 'second.ts'], { MCP_TEST_FS_FAULT: fault }).done;
      expect(result.code).not.toBe(0);
      expect(result.output).not.toContain('SENTINEL');
      if (fault === 'stage') {
        for (const name of ['first.generated.ts', 'second.generated.ts'])
          expect(await readFile(join(directory, name), 'utf8')).toBe('before');
      } else if (fault === 'rename') {
        expect(await readFile(join(directory, 'first.generated.ts'), 'utf8')).toContain('MCPServers');
        expect(await readFile(join(directory, 'second.generated.ts'), 'utf8')).toBe('before');
      }
      if (fault !== 'cleanup') expect((await readdir(directory)).some(name => name.endsWith('.tmp'))).toBe(false);
    },
  );

  it.each(['', 'auth'])('discovers real HTTP schemas or safely rejects HTTP authentication (%s)', async mode => {
    await writeFile(join(directory, 'mode'), mode);
    const ready = join(directory, 'ready');
    const http = spawn(process.execPath, [server, 'http', join(directory, 'events'), ready, join(directory, 'mode')], {
      stdio: 'ignore',
    });
    try {
      let url = '';
      for (let i = 0; i < 200 && !url; i++) {
        url = await readFile(ready, 'utf8').catch(() => '');
        if (!url) await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(url).not.toBe('');
      await client(
        'http.ts',
        'http.generated.ts',
        `{weather:{url:new URL(${JSON.stringify(url + '?token=SENTINEL_URL_SECRET')}),requestInit:{headers:{Authorization:'SENTINEL_HEADER_SECRET'}},timeout:1000}}`,
      );
      const result = await launch(['generate', 'http.ts'], { VERBOSE: '1' }).done;
      expect(result.output).not.toContain('SENTINEL');
      if (mode === 'auth') expect(result.code).not.toBe(0);
      else {
        expect(result.code, result.output).toBe(0);
        expect(await readFile(join(directory, 'http.generated.ts'), 'utf8')).toContain('celsius');
        expect((await events()).filter(event => event.event === 'call')).toHaveLength(0);
        expect((await events()).some(event => event.event === 'closed')).toBe(true);
      }
    } finally {
      const closed = new Promise(resolve => http.once('close', resolve));
      http.kill('SIGTERM');
      await closed;
    }
  });

  it('deduplicates same-id cached aliases using the original metadata', async () => {
    await client(
      'client.ts',
      'original.ts',
      '{}',
      `export const alias = new MCPClient({id:'client.ts',servers:{},typegen:{outFile:'ignored.ts'}});`,
    );
    const result = await launch(['generate', 'client.ts']).done;
    expect(result.code, result.output).toBe(0);
    expect(result.output).toContain('Generated 1');
    expect(await readdir(directory)).toContain('original.ts');
    expect(await readdir(directory)).not.toContain('ignored.ts');
  });

  it('handles SIGTERM during discovery without orphaning stdio children', async () => {
    await client('client.ts', 'generated.ts', stdio());
    await writeFile(join(directory, 'mode'), 'stall');
    const run = launch(['generate', 'client.ts']);
    await waitForEvent('list');
    run.child.kill('SIGTERM');
    expect((await run.done).code).not.toBe(0);
    expect((await events()).some(item => item.event === 'exit')).toBe(true);
    expect(await readdir(directory)).not.toContain('generated.ts');
  });
});
