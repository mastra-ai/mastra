import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const checkEnv = resolve(root, 'scripts/check-env.mjs');
const checkDocs = resolve(root, 'scripts/check-docs.mjs');
const temporaryDirectories: string[] = [];
const localKey = 'phase007-local-signing-key-at-least-32-characters';

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

function run(script: string, args: string[] = [], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    env,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

function localEnvironment(overrides: Record<string, string> = {}) {
  return {
    LOCAL_AUTH_SIGNING_KEY: localKey,
    SUPPORT_SOURCE: 'mock',
    COMMERCE_SOURCE: 'mock',
    ...overrides,
  };
}

describe('PHASE-007 environment validation', () => {
  it('keeps the local pre-push preflight deterministic without an OpenAI key', async () => {
    const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts['verify:pre-push']).toBe('node scripts/verify-pre-push.mjs');

    const keyFreeEnvironment = localEnvironment();
    expect(keyFreeEnvironment).not.toHaveProperty('OPENAI_API_KEY');

    const result = run(checkEnv, ['--profile=local', '--mode=deterministic'], keyFreeEnvironment);

    expect(result).toMatchObject({ status: 0 });
    expect(result.output).toContain('Environment profile local is valid in deterministic mode.');
  });

  it('accepts the explicit deterministic local mock profile without creating its database', async () => {
    const directory = await temporaryDirectory();
    const database = join(directory, 'must-not-exist.db');
    const result = run(
      checkEnv,
      ['--profile=local', '--mode=deterministic'],
      localEnvironment({ DATABASE_URL: `file:${database}` }),
    );

    expect(result).toMatchObject({ status: 0 });
    expect(result.output).toContain('Environment profile local is valid in deterministic mode.');
    expect(existsSync(database)).toBe(false);
  });

  it('checks the active local database while retaining an inactive remote TURSO URL', async () => {
    const directory = await temporaryDirectory();
    const result = run(
      checkEnv,
      ['--profile=local', '--mode=deterministic'],
      localEnvironment({
        APP_MODE: 'local',
        LOCAL_DEMO_DATABASE_URL: `file:${join(directory, 'local.db')}`,
        LOCAL_DEMO_CLIENT_DATABASE_URL: `file:${join(directory, 'client.db')}`,
        DATABASE_URL: 'libsql://preserved-external.example',
        DEMO_DATABASE_URL: 'libsql://preserved-client.example',
      }),
    );

    expect(result).toMatchObject({ status: 0 });
    expect(result.output).toContain('Environment profile local is valid in deterministic mode.');
  });

  it('rejects missing and short local signing keys', () => {
    for (const environment of [
      { SUPPORT_SOURCE: 'mock', COMMERCE_SOURCE: 'mock' },
      localEnvironment({ LOCAL_AUTH_SIGNING_KEY: 'short' }),
    ]) {
      const result = run(checkEnv, ['--profile=local', '--mode=deterministic'], environment);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain('LOCAL_AUTH_SIGNING_KEY');
    }
  });

  it('requires a non-empty OpenAI key by default and keeps deterministic validation explicit', () => {
    for (const environment of [localEnvironment(), localEnvironment({ OPENAI_API_KEY: '   ' })]) {
      const result = run(checkEnv, ['--profile=local'], environment);
      expect(result.status).not.toBe(0);
      expect(result.output).toContain('OPENAI_API_KEY is required for interactive mode.');
    }

    const interactive = run(
      checkEnv,
      ['--profile=local'],
      localEnvironment({ OPENAI_API_KEY: 'synthetic-interactive-key' }),
    );
    expect(interactive).toMatchObject({ status: 0 });
    expect(interactive.output).toContain('valid in interactive mode.');

    const unknown = run(checkEnv, ['--profile=local', '--mode=preview'], localEnvironment());
    expect(unknown.status).not.toBe(0);
    expect(unknown.output).toContain('Unknown environment mode.');
  });

  it('validates every enabled provider even when a different named profile is selected', () => {
    const token = 'intercom-token-that-must-never-appear-in-errors';
    const result = run(
      checkEnv,
      ['--profile=stripe', '--mode=deterministic'],
      localEnvironment({
        SUPPORT_SOURCE: 'intercom',
        INTERCOM_ACCESS_TOKEN: token,
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('INTERCOM_DEVELOPMENT_ENABLED');
    expect(result.output).toContain('STRIPE_SANDBOX_ENABLED');
    expect(result.output).not.toContain(token);
  });

  it('rejects live Stripe keys, unapproved origins, and retention expansion without exposing values', () => {
    const liveKey = 'rk_live_this-value-must-never-appear-in-errors';
    const result = run(
      checkEnv,
      ['--mode=deterministic'],
      localEnvironment({
        COMMERCE_SOURCE: 'stripe',
        STRIPE_SANDBOX_ENABLED: 'true',
        STRIPE_TENANT_ID: 'local-demo',
        STRIPE_ACCOUNT_ID: 'acct_synthetic',
        STRIPE_RESTRICTED_API_KEY: liveKey,
        STRIPE_WEBHOOK_SECRET: 'whsec_synthetic',
        STRIPE_API_BASE_URL: 'https://unapproved.invalid',
        SUPPORT_RETENTION_CASE_DAYS: '91',
      }),
    );

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('STRIPE_RESTRICTED_API_KEY must be a Stripe test restricted key.');
    expect(result.output).toContain('STRIPE_API_BASE_URL must use an approved provider API origin.');
    expect(result.output).toContain('SUPPORT_RETENTION_CASE_DAYS must be an integer from 1 through 90.');
    expect(result.output).not.toContain(liveKey);
  });
});

describe('PHASE-007 documentation validation', () => {
  it('documents the restricted Customers: Write capability required for approved credits', async () => {
    const [environmentReference, adapters] = await Promise.all([
      readFile(resolve(root, 'docs/env-variables.md'), 'utf8'),
      readFile(resolve(root, 'docs/external-adapters.md'), 'utf8'),
    ]);
    for (const document of [environmentReference, adapters]) {
      expect(document).toContain('Customers: Write');
      expect(document).toContain('customer balance transaction');
      expect(document).not.toContain('credits, and invoice changes are not performed');
    }
  });

  it('accepts a complete synthetic fixture and rejects each release-documentation failure', async () => {
    const repository = await documentationFixture();
    expect(run(join(repository, 'scripts/check-docs.mjs'), [], {}).status).toBe(0);

    await writeFile(
      join(repository, 'README.md'),
      '[missing](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/missing.md)\n',
    );
    expect(run(join(repository, 'scripts/check-docs.mjs')).output).toContain(
      'links to missing repository path https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/missing.md',
    );

    await writeFile(
      join(repository, 'README.md'),
      '[bad](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/local-demo.md#missing-anchor)\n',
    );
    expect(run(join(repository, 'scripts/check-docs.mjs')).output).toContain(
      'links to missing anchor https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/local-demo.md#missing-anchor',
    );

    await writeFile(join(repository, 'README.md'), '[relative](docs/local-demo.md)\n');
    expect(run(join(repository, 'scripts/check-docs.mjs')).output).toContain(
      'README.md must use absolute links, not docs/local-demo.md',
    );

    await writeFile(join(repository, 'README.md'), 'npm run obsolete\n');
    expect(run(join(repository, 'scripts/check-docs.mjs')).output).toContain('references missing npm script obsolete');

    await writeFile(join(repository, 'README.md'), 'sk-abcdefghijklmnopqrstuvwxyz012345\n');
    expect(run(join(repository, 'scripts/check-docs.mjs')).output).toContain('looks like a committed secret');

    await writeFile(join(repository, 'README.md'), '# Valid\n');
    await writeFile(join(repository, 'docs/local-demo.md'), '# Example\nalex@example.com\n');
    expect(run(join(repository, 'scripts/check-docs.mjs')).output).toContain(
      'must identify every example as mock data or synthetic',
    );
  });
});

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'phase007-release-script-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function documentationFixture() {
  const repository = await temporaryDirectory();
  await Promise.all([
    mkdir(join(repository, 'scripts'), { recursive: true }),
    mkdir(join(repository, 'support-demo-ui'), { recursive: true }),
    mkdir(join(repository, 'client-demo-ui'), { recursive: true }),
    mkdir(join(repository, 'docs'), { recursive: true }),
  ]);
  await cp(checkDocs, join(repository, 'scripts/check-docs.mjs'));
  await Promise.all([
    writeFile(join(repository, 'package.json'), JSON.stringify({ scripts: { check: 'node check.mjs' } })),
    writeFile(join(repository, 'support-demo-ui/package.json'), JSON.stringify({ scripts: { dev: 'vite' } })),
    writeFile(
      join(repository, 'README.md'),
      '# Valid\n[Example](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/local-demo.md#local-demo)\nnpm run check\n',
    ),
    writeFile(join(repository, '.env.example'), 'LOCAL_AUTH_SIGNING_KEY=\n'),
    writeFile(join(repository, 'CONTRIBUTING.md'), '# Contributing\n'),
    writeFile(
      join(repository, 'client-demo-ui/package.json'),
      JSON.stringify({ scripts: { dev: 'tsx src/server.tsx' } }),
    ),
    writeFile(
      join(repository, 'docs/local-demo.md'),
      '# Local demo\nEvery identity, message, order, and result below uses mock data.\n',
    ),
    writeFile(join(repository, 'docs/policies-and-actions.md'), '# Policies\n'),
    writeFile(join(repository, 'docs/external-adapters.md'), '# Adapters\n'),
    writeFile(join(repository, 'docs/env-variables.md'), '# Environment variables\n'),
  ]);
  return repository;
}
