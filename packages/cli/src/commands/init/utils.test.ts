import { fs, vol } from 'memfs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

const { writeObservabilityEnv } = await import('./utils');

describe('writeObservabilityEnv', () => {
  const cwd = '/mock-project';

  beforeEach(() => {
    vol.reset();
    fs.mkdirSync(cwd, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  });

  test('appends placeholder MASTRA_CLOUD_ACCESS_TOKEN to .env', async () => {
    fs.writeFileSync(`${cwd}/.env`, 'EXISTING=1\n');

    await writeObservabilityEnv();

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('EXISTING=1');
    expect(contents).toContain('# Mastra Observability');
    expect(contents).toContain('MASTRA_CLOUD_ACCESS_TOKEN=');
    expect(contents).not.toMatch(/MASTRA_CLOUD_ACCESS_TOKEN=\S/);
  });

  test('writes a real token and project id when provided', async () => {
    fs.writeFileSync(`${cwd}/.env`, '');

    await writeObservabilityEnv({ token: 'sk_abc123', projectId: 'proj_xyz' });

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('MASTRA_CLOUD_ACCESS_TOKEN=sk_abc123');
    expect(contents).toContain('MASTRA_PROJECT_ID=proj_xyz');
    // No endpoint emitted unless explicitly passed.
    expect(contents).not.toContain('MASTRA_CLOUD_TRACES_ENDPOINT');
  });

  test('writes the traces endpoint only when provided', async () => {
    fs.writeFileSync(`${cwd}/.env`, '');

    await writeObservabilityEnv({
      token: 'sk_abc',
      projectId: 'proj_x',
      endpoint: 'http://localhost:8080/projects/proj_x/ai/spans/publish',
    });

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('MASTRA_CLOUD_TRACES_ENDPOINT=http://localhost:8080/projects/proj_x/ai/spans/publish');
  });

  test('creates the .env file if it does not exist', async () => {
    await writeObservabilityEnv();

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('MASTRA_CLOUD_ACCESS_TOKEN=');
    expect(contents).toContain('MASTRA_PROJECT_ID=');
  });
});
