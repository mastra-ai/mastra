import { execFile } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { operationalEvaluationExclusions } from '../../../src/mastra/evaluation/state.js';
import type { SourceCatalog } from '../../../src/mastra/workspaces/catalog.js';
import { validateEnvironment } from '../../../src/mastra/workspaces/catalog.js';
import { catalog } from '../../fixtures/s3.js';
const command = promisify(execFile);
describe('S3-multimount integration', () => {
  it('multimount setup preserves local and experiment profiles', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-s3-'));
    try {
      const records = join(directory, 'records');
      await mkdir(records);
      const localOnly: SourceCatalog = {
        version: 1,
        sources: [{ id: 'sample', provider: 'local', mountPath: '/sample', root: './records', enabled: true }],
      };
      expect(validateEnvironment(localOnly, { OPENAI_API_KEY: 'synthetic' })).toEqual([]);
      const configurationPath = join(directory, 'source-catalog.json');
      await (await import('node:fs/promises')).writeFile(configurationPath, JSON.stringify(localOnly));
      const after = await operationalEvaluationExclusions(directory);
      expect(after).toContain(join(directory, '.mastra'));
      const combined = catalog();
      combined.sources.unshift({
        id: 'offline-local',
        provider: 'local',
        mountPath: '/local',
        root: '.',
        enabled: false,
      });
      await (await import('node:fs/promises')).writeFile(configurationPath, JSON.stringify(combined));
      expect(
        validateEnvironment(combined, {
          OPENAI_API_KEY: 'synthetic',
          GOOGLE_DRIVE_CLIENT_EMAIL: 'synthetic@example.test',
          GOOGLE_DRIVE_PRIVATE_KEY: 'synthetic-private-key',
        }),
      ).toEqual(expect.arrayContaining(['Enabled S3 sources require both accepted S3 credential settings.']));
      // This exclusion read is the same F5 seed/inspect guard: it loads only catalog
      // metadata and keeps an enabled-but-unconfigured remote source offline.
      expect(await operationalEvaluationExclusions(directory)).toEqual(
        expect.arrayContaining([join(directory, '.mastra')]),
      );

      // check-env reads catalog and credentials only; these profiles prove it never
      // launches an enabled remote provider while preserving operator files.
      const checkEnvironment = fileURLToPath(new URL('../../../scripts/check-env.mjs', import.meta.url));
      const environmentFile = join(directory, '.env');
      const stateFile = join(directory, '.mastra', 'operator-state');
      await mkdir(join(directory, '.mastra'), { recursive: true });
      await writeFile(environmentFile, 'OPENAI_API_KEY=synthetic\n');
      await writeFile(stateFile, 'state-preserved\n');
      await writeFile(configurationPath, JSON.stringify(localOnly));
      await command(process.execPath, ['--env-file=.env', checkEnvironment], {
        cwd: directory,
        env: { ...process.env },
      });
      const driveOnly = catalog();
      driveOnly.sources[1]!.enabled = false;
      driveOnly.sources.pop();
      await writeFile(
        environmentFile,
        'OPENAI_API_KEY=synthetic\nGOOGLE_DRIVE_CLIENT_EMAIL=fixture@example.test\nGOOGLE_DRIVE_PRIVATE_KEY=fixture-key\n',
      );
      await writeFile(configurationPath, JSON.stringify(driveOnly));
      await command(process.execPath, ['--env-file=.env', checkEnvironment], {
        cwd: directory,
        env: { ...process.env },
      });
      await writeFile(configurationPath, JSON.stringify(combined));
      await expect(
        command(process.execPath, ['--env-file=.env', checkEnvironment], { cwd: directory, env: { ...process.env } }),
      ).rejects.toMatchObject({ code: 1 });
      expect(await readFile(environmentFile, 'utf8')).toContain('GOOGLE_DRIVE_CLIENT_EMAIL');
      expect(await readFile(configurationPath, 'utf8')).toContain('"archive"');
      expect(await readFile(stateFile, 'utf8')).toBe('state-preserved\n');

      const bin = join(directory, 'bin');
      const log = join(directory, 'bootstrap.log');
      await mkdir(bin);
      const fakeNpm = join(bin, 'npm');
      await cp(new URL('../../fixtures/npm.sh', import.meta.url), fakeNpm);
      await chmod(fakeNpm, 0o755);
      const bootstrap = fileURLToPath(new URL('../../../scripts/bootstrap.mjs', import.meta.url));
      await command(process.execPath, [bootstrap], {
        cwd: directory,
        env: { ...process.env, BOOTSTRAP_LOG: log, PATH: `${bin}:${process.env.PATH}` },
      });
      expect(await readFile(log, 'utf8')).toBe('ci\nrun dev\n');
      expect(await readFile(stateFile, 'utf8')).toBe('state-preserved\n');

      // The isolated F5 state accepts a sibling and rejects a symlink to the
      // operational state before any experiment fixtures could be seeded.
      const { assertIsolatedEvaluationState } = await import('../../../src/mastra/evaluation/state.js');
      const siblingState = join(directory, 'f5-isolated');
      await expect(assertIsolatedEvaluationState(siblingState, [join(directory, '.mastra')])).resolves.toEqual(
        expect.stringContaining('f5-isolated'),
      );
      const alias = join(directory, 'operational-alias');
      await symlink(join(directory, '.mastra'), alias);
      await expect(assertIsolatedEvaluationState(alias, [join(directory, '.mastra')])).rejects.toThrow(
        'must not overlap',
      );
      const {
        OPENAI_API_KEY: _openAi,
        GOOGLE_DRIVE_CLIENT_EMAIL: _driveEmail,
        GOOGLE_DRIVE_PRIVATE_KEY: _driveKey,
        S3_ACCESS_KEY_ID: _s3Key,
        S3_SECRET_ACCESS_KEY: _s3Secret,
        ...withoutProviders
      } = process.env;
      await command('npm', ['exec', '--', 'tsc', '-p', 'tsconfig.eval.json'], {
        cwd: process.cwd(),
        env: withoutProviders,
      });
      const evaluationRunner = join(process.cwd(), 'build', 'eval', 'mastra', 'evaluation', 'eval-runner.js');
      const evaluationState = await mkdtemp(join(tmpdir(), 'organization-f5-seeded-'));
      try {
        await command(process.execPath, [evaluationRunner, '--mode', 'seed', '--state-dir', evaluationState], {
          cwd: directory,
          env: withoutProviders,
        });
        const firstSeed = JSON.parse(await readFile(join(evaluationState, 'evaluation-report.json'), 'utf8')) as {
          settings: {
            mode: string;
            embeddingCalls: number;
            answerCalls: number;
            judgeCalls: number;
            modeOutput: { seeded: { agentVersion: number; retrievalVersion: number; calibrationVersion: number } };
          };
        };
        expect(firstSeed.settings).toMatchObject({ mode: 'seed', embeddingCalls: 0, answerCalls: 0, judgeCalls: 0 });
        await command(process.execPath, [evaluationRunner, '--mode', 'seed', '--state-dir', evaluationState], {
          cwd: directory,
          env: withoutProviders,
        });
        const secondSeed = JSON.parse(await readFile(join(evaluationState, 'evaluation-report.json'), 'utf8')) as {
          settings: {
            mode: string;
            embeddingCalls: number;
            answerCalls: number;
            judgeCalls: number;
            modeOutput: { seeded: { agentVersion: number; retrievalVersion: number; calibrationVersion: number } };
          };
        };
        expect(secondSeed.settings).toMatchObject({ mode: 'seed', embeddingCalls: 0, answerCalls: 0, judgeCalls: 0 });
        expect(secondSeed.settings.modeOutput.seeded).toEqual(firstSeed.settings.modeOutput.seeded);
        expect(await readFile(stateFile, 'utf8')).toBe('state-preserved\n');
      } finally {
        await rm(evaluationState, { recursive: true, force: true });
      }
      const smokeConfig = fileURLToPath(new URL('../../../vitest.s3-r2.config.ts', import.meta.url));
      await expect(
        command(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', smokeConfig], {
          cwd: process.cwd(),
          env: { ...process.env, S3_R2_SMOKE_FIXTURE_PATH: '' },
        }),
      ).rejects.toMatchObject({ code: 1 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
