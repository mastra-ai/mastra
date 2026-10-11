import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';

const execute = promisify(execFile);
let root: string;
beforeEach(async () => {
  root = await temporaryDirectory();
});
afterEach(async () => {
  await cleanupDirectory(root);
});
describe('local setup regression', () => {
  it('installs_locally_with_a_fake_npm_entry_and_preserves_an_existing_environment_file', async () => {
    await copyFile(resolve('scripts/setup.ts'), resolve(root, 'setup.ts'));
    await writeFile(resolve(root, '.env.example'), 'OPENAI_API_KEY=\n');
    await writeFile(resolve(root, '.env'), 'OPERATOR_MARKER=keep-existing-value\n');
    await writeFile(
      resolve(root, 'npm-stub.ts'),
      "import {writeFileSync} from 'node:fs';writeFileSync('npm-arguments.json',JSON.stringify(process.argv.slice(2)));\n",
    );
    await execute(process.execPath, ['setup.ts'], {
      cwd: root,
      env: { ...process.env, npm_execpath: resolve(root, 'npm-stub.ts') },
    });
    expect(JSON.parse(await readFile(resolve(root, 'npm-arguments.json'), 'utf8'))).toEqual([
      'install',
      '--workspaces=false',
    ]);
    expect(await readFile(resolve(root, '.env'), 'utf8')).toBe('OPERATOR_MARKER=keep-existing-value\n');
  });
  it('creates_the_initial_environment_file_without_using_the_network', async () => {
    await copyFile(resolve('scripts/setup.ts'), resolve(root, 'setup.ts'));
    await writeFile(resolve(root, '.env.example'), 'OPENAI_API_KEY=\n');
    await writeFile(resolve(root, 'npm-stub.ts'), 'export {};\n');
    await execute(process.execPath, ['setup.ts'], {
      cwd: root,
      env: { ...process.env, npm_execpath: resolve(root, 'npm-stub.ts') },
    });
    expect(await readFile(resolve(root, '.env'), 'utf8')).toBe('OPENAI_API_KEY=\n');
  });
});
