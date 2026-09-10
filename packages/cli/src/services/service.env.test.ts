import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileEnvService } from './service.env';

vi.mock('node:fs/promises', async importOriginal => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
}));

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
    await expect(service.setEnvValue('DB_URL', 'postgres://localhost')).resolves.toBeUndefined();

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toContain('EXISTING=1');
    expect(content).toContain('DB_URL=postgres://localhost');
    await expect(service.getEnvValue('DB_URL')).resolves.toBe('postgres://localhost');
  });

  it('updates an existing key without removing other entries', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, 'DB_URL=old\nOPENAI_API_KEY=sk-test\n', 'utf8');

    const service = new FileEnvService(envPath);
    await expect(service.setEnvValue('DB_URL', 'postgres://new')).resolves.toBeUndefined();

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

  it('rejects when the env file does not exist without creating it', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const service = new FileEnvService(envPath);
    await expect(service.setEnvValue('DB_URL', 'value')).rejects.toMatchObject({ code: 'ENOENT' });

    await expect(fs.stat(envPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(errorSpy).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('Error writing ENV value:'));
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('rejects with the original read error without attempting a write', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = new Error('injected read failure');
    vi.spyOn(fs, 'readFile').mockRejectedValueOnce(error);
    const writeSpy = vi.spyOn(fs, 'writeFile');

    const service = new FileEnvService(envPath);
    await expect(service.setEnvValue('DB_URL', 'value')).rejects.toBe(error);

    expect(errorSpy).toHaveBeenCalledExactlyOnceWith(`Error writing ENV value: ${error}`);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('rejects with the original write error after reading the env file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await fs.writeFile(envPath, 'DB_URL=old\nOTHER=1\n', 'utf8');
    const error = new Error('injected write failure');
    const writeSpy = vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(error);

    const service = new FileEnvService(envPath);
    await expect(service.setEnvValue('DB_URL', 'new')).rejects.toBe(error);

    expect(writeSpy).toHaveBeenCalledExactlyOnceWith(envPath, 'DB_URL=new\nOTHER=1\n', 'utf8');
    expect(await fs.readFile(envPath, 'utf8')).toBe('DB_URL=old\nOTHER=1\n');
    expect(errorSpy).toHaveBeenCalledExactlyOnceWith(`Error writing ENV value: ${error}`);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('rejects env keys that are not valid identifiers', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, 'DB.URL=first\nOTHER=1\n', 'utf8');

    const service = new FileEnvService(envPath);
    await expect(service.setEnvValue('DB.URL', 'second')).rejects.toThrow('Invalid ENV key: DB.URL');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('DB.URL=first\nOTHER=1\n');
    expect(errorSpy).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid env keys without writing to the env file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, 'SAFE=1\n', 'utf8');

    const service = new FileEnvService(envPath);
    await expect(service.setEnvValue('BAD KEY', 'value')).rejects.toThrow('Invalid ENV key: BAD KEY');

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('SAFE=1\n');
    expect(errorSpy).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('rejects multiline values without writing to the env file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, 'DB_URL=safe\n', 'utf8');

    const service = new FileEnvService(envPath);
    await expect(service.setEnvValue('DB_URL', 'line1\nINJECTED=1')).rejects.toThrow(
      'Invalid ENV value for DB_URL: multiline values are not supported.',
    );

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('DB_URL=safe\n');
    expect(errorSpy).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('rejects carriage-return values without writing to the env file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await fs.writeFile(envPath, 'DB_URL=safe\n', 'utf8');

    const service = new FileEnvService(envPath);
    await expect(service.setEnvValue('DB_URL', 'unsafe\rvalue')).rejects.toThrow(
      'Invalid ENV value for DB_URL: multiline values are not supported.',
    );

    const content = await fs.readFile(envPath, 'utf8');
    expect(content).toBe('DB_URL=safe\n');
    expect(errorSpy).toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
