import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileEnvService } from './service.env';

describe('FileEnvService', () => {
  let tmpDir: string;
  let envPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-cli-env-'));
    envPath = path.join(tmpDir, '.env.development');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('reads an existing env value', async () => {
    await fs.writeFile(envPath, 'DB_URL=postgres://localhost\nAPI_KEY=secret\n', 'utf8');

    const service = new FileEnvService(envPath);

    await expect(service.getEnvValue('DB_URL')).resolves.toBe('postgres://localhost');
    await expect(service.getEnvValue('API_KEY')).resolves.toBe('secret');
  });

  it('returns null when the key is missing', async () => {
    await fs.writeFile(envPath, 'DB_URL=postgres://localhost\n', 'utf8');

    const service = new FileEnvService(envPath);

    await expect(service.getEnvValue('MISSING')).resolves.toBeNull();
  });

  it('returns null when the env file does not exist', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const service = new FileEnvService(envPath);

    await expect(service.getEnvValue('DB_URL')).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('appends a new key when setting a value', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, 'EXISTING=1\n', 'utf8');

    const service = new FileEnvService(envPath);
    await service.setEnvValue('DB_URL', 'postgres://localhost');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toContain('EXISTING=1');
    expect(content).toContain('DB_URL=postgres://localhost');
    await expect(service.getEnvValue('DB_URL')).resolves.toBe('postgres://localhost');
  });

  it('updates an existing key without removing other entries', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, 'DB_URL=old\nOPENAI_API_KEY=sk-test\n', 'utf8');

    const service = new FileEnvService(envPath);
    await service.setEnvValue('DB_URL', 'postgres://new');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('DB_URL=postgres://new\nOPENAI_API_KEY=sk-test\n');
    await expect(service.getEnvValue('DB_URL')).resolves.toBe('postgres://new');
  });

  it('writes values containing $ literally without replacement expansion', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, 'TOKEN=old\n', 'utf8');

    const service = new FileEnvService(envPath);
    await service.setEnvValue('TOKEN', 'cost-$100&$200');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('TOKEN=cost-$100&$200\n');
    expect(infoSpy).toHaveBeenCalledWith('TOKEN set in ENV file.');
    expect(infoSpy).not.toHaveBeenCalledWith(expect.stringContaining('cost-$100'));
  });

  it('logs only the key when setting a value', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, '', 'utf8');

    const service = new FileEnvService(envPath);
    await service.setEnvValue('DB_URL', 'postgres://user:secret@host/db');

    expect(infoSpy).toHaveBeenCalledWith('DB_URL set in ENV file.');
    expect(infoSpy).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
  });

  it('rejects env keys that are not valid identifiers', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await fs.writeFile(envPath, 'DB.URL=first\nOTHER=1\n', 'utf8');

    const service = new FileEnvService(envPath);
    await service.setEnvValue('DB.URL', 'second');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('DB.URL=first\nOTHER=1\n');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rejects invalid env keys without writing to the env file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await fs.writeFile(envPath, 'SAFE=1\n', 'utf8');

    const service = new FileEnvService(envPath);
    await service.setEnvValue('BAD KEY', 'value');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('SAFE=1\n');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rejects multiline values without writing to the env file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await fs.writeFile(envPath, 'DB_URL=safe\n', 'utf8');

    const service = new FileEnvService(envPath);
    await service.setEnvValue('DB_URL', 'line1\nINJECTED=1');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('DB_URL=safe\n');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rejects carriage-return values without writing to the env file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await fs.writeFile(envPath, 'DB_URL=safe\n', 'utf8');

    const service = new FileEnvService(envPath);
    await service.setEnvValue('DB_URL', 'unsafe\rvalue');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('DB_URL=safe\n');
    expect(errorSpy).toHaveBeenCalled();
  });
});
