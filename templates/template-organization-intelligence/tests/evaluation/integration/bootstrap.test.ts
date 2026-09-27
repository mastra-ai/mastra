import { execFile } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const command = promisify(execFile);
describe('Evaluation integration', () => {
  it('extracts the real entrypoint server configuration before starting Mastra', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-server-config-'));
    const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
    try {
      await cp(join(projectRoot, 'src'), join(directory, 'src'), { recursive: true });
      await cp(join(projectRoot, 'package.json'), join(directory, 'package.json'));
      await symlink(join(projectRoot, 'node_modules'), join(directory, 'node_modules'), 'dir');
      await mkdir(join(directory, 'documents'));
      await mkdir(join(directory, '.mastra/output'), { recursive: true });
      await writeFile(
        join(directory, 'source-catalog.json'),
        JSON.stringify({
          version: 1,
          sources: [{ id: 'sample', provider: 'local', mountPath: '/sample', root: './documents', enabled: true }],
        }),
      );
      const { stdout } = await command(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `import { getServerOptions } from '@mastra/deployer/build';
          const server = await getServerOptions(
            process.cwd() + '/src/mastra/index.ts', process.cwd() + '/.mastra/output'
          );
          console.log(JSON.stringify({ host: server.host, routes: server.apiRoutes.map(route => route.path) }));`,
        ],
        { cwd: directory, env: { PATH: process.env.PATH, OPENAI_API_KEY: 'synthetic-key' }, timeout: 12000 },
      );
      expect(JSON.parse(stdout.trim())).toEqual({
        host: '127.0.0.1',
        routes: ['/organization-answer', '/organization-telemetry'],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('local bootstrap and checks are reproducible', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-bootstrap-'));
    const bin = join(directory, 'bin');
    const log = join(directory, 'calls.log');
    await mkdir(join(directory, '.mastra'), { recursive: true });
    await mkdir(bin);
    await Promise.all([
      writeFile(join(directory, '.env'), 'BOOTSTRAP_ENV_SENTINEL=yes\n'),
      writeFile(join(directory, 'source-catalog.json'), '{"sentinel":"BOOTSTRAP_CATALOG_SENTINEL"}\n'),
      writeFile(join(directory, '.mastra', 'state'), 'BOOTSTRAP_STATE_SENTINEL\n'),
    ]);
    const fakeNpm = join(bin, 'npm');
    await cp(new URL('../../fixtures/npm.sh', import.meta.url), fakeNpm);
    await chmod(fakeNpm, 0o755);
    const script = fileURLToPath(new URL('../../../scripts/bootstrap.mjs', import.meta.url));
    const environment = { ...process.env, BOOTSTRAP_LOG: log, PATH: `${bin}:${process.env.PATH}` };
    await command(process.execPath, [script], { cwd: directory, env: environment });
    await command(process.execPath, [script], { cwd: directory, env: environment });
    expect((await readFile(log, 'utf8')).trim().split('\n')).toEqual(['ci', 'run dev', 'ci', 'run dev']);
    await expect(readFile(join(directory, '.env'), 'utf8')).resolves.toContain('BOOTSTRAP_ENV_SENTINEL');
    await expect(readFile(join(directory, 'source-catalog.json'), 'utf8')).resolves.toContain(
      'BOOTSTRAP_CATALOG_SENTINEL',
    );
    await expect(readFile(join(directory, '.mastra', 'state'), 'utf8')).resolves.toContain('BOOTSTRAP_STATE_SENTINEL');
    await writeFile(log, '');
    await expect(
      command(process.execPath, [script], { cwd: directory, env: { ...environment, BOOTSTRAP_FAIL: 'install' } }),
    ).rejects.toMatchObject({ code: 17 });
    expect(await readFile(log, 'utf8')).toBe('ci\n');
    await writeFile(log, '');
    await expect(
      command(process.execPath, [script], { cwd: directory, env: { ...environment, BOOTSTRAP_FAIL: 'dev' } }),
    ).rejects.toMatchObject({ code: 19 });
    expect(await readFile(log, 'utf8')).toBe('ci\nrun dev\n');
    const checkDirectory = join(directory, 'check');
    const checkBin = join(checkDirectory, 'bin');
    const checkLog = join(checkDirectory, 'stages.log');
    await mkdir(checkBin, { recursive: true });
    const packageJson = JSON.parse(
      await readFile(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
    ) as {
      scripts: Record<string, string>;
    };
    await writeFile(
      join(checkDirectory, 'package.json'),
      JSON.stringify({ name: 'controlled-check', version: '0.0.0', scripts: packageJson.scripts }),
    );
    const stages = ['oxfmt', 'oxlint', 'eslint', 'tsc', 'vitest', 'mastra'];
    await Promise.all(
      stages.map(async stage => {
        const executable = join(checkBin, stage);
        await cp(new URL('../../fixtures/check-stage.sh', import.meta.url), executable);
        await chmod(executable, 0o755);
      }),
    );
    const npmCli = (await command('which', ['npm'])).stdout.trim();
    const checkEnvironment = { ...process.env, CHECK_LOG: checkLog, PATH: `${checkBin}:${process.env.PATH}` };
    await command(npmCli, ['--prefix', checkDirectory, 'run', 'check'], { env: checkEnvironment });
    expect((await readFile(checkLog, 'utf8')).trim().split('\n')).toEqual(stages);
    for (const [index, stage] of stages.entries()) {
      await writeFile(checkLog, '');
      await expect(
        command(npmCli, ['--prefix', checkDirectory, 'run', 'check'], {
          env: { ...checkEnvironment, CHECK_FAIL_STAGE: stage },
        }),
      ).rejects.toMatchObject({ code: 23 });
      expect((await readFile(checkLog, 'utf8')).trim().split('\n')).toEqual(stages.slice(0, index + 1));
    }
    await rm(directory, { recursive: true, force: true });
  });
});
