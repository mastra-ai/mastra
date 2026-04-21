import { fs, vol } from 'memfs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

const { writeObserveEnv } = await import('./utils');

describe('writeObserveEnv', () => {
  const cwd = '/mock-project';

  beforeEach(() => {
    vol.reset();
    fs.mkdirSync(cwd, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  });

  test('appends placeholder MASTRA_CLOUD_ACCESS_TOKEN to .env', async () => {
    fs.writeFileSync(`${cwd}/.env`, 'EXISTING=1\n');

    await writeObserveEnv();

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('EXISTING=1');
    expect(contents).toContain('# Mastra Observe');
    expect(contents).toContain('MASTRA_CLOUD_ACCESS_TOKEN=');
    expect(contents).not.toMatch(/MASTRA_CLOUD_ACCESS_TOKEN=\S/);
  });

  test('writes a real token when one is provided', async () => {
    fs.writeFileSync(`${cwd}/.env`, '');

    await writeObserveEnv({ token: 'tok_abc123' });

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('MASTRA_CLOUD_ACCESS_TOKEN=tok_abc123');
  });

  test('creates the .env file if it does not exist', async () => {
    await writeObserveEnv();

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('MASTRA_CLOUD_ACCESS_TOKEN=');
  });
});
