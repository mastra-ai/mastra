import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { upsertEnvFile } from './env.js';

let workDir: string;

beforeEach(() => {
  workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-env-test-')));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('upsertEnvFile', () => {
  it('replaces existing uncommented keys in place', () => {
    const envPath = path.join(workDir, '.env');
    fs.writeFileSync(envPath, 'FOO=old\nBAR=keep\nBAZ=old\n');

    upsertEnvFile(envPath, { FOO: 'new', BAZ: 'new' });

    expect(fs.readFileSync(envPath, 'utf8')).toBe('FOO=new\nBAR=keep\nBAZ=new\n');
  });

  it('replaces commented placeholders in place (drops the "#")', () => {
    const envPath = path.join(workDir, '.env');
    fs.writeFileSync(envPath, '# API_KEY=\n# OTHER=\n');

    upsertEnvFile(envPath, { API_KEY: 'sk_abc' });

    // The commented line becomes the real one; unrelated commented lines stay.
    expect(fs.readFileSync(envPath, 'utf8')).toBe('API_KEY=sk_abc\n# OTHER=\n');
  });

  it('appends missing keys at the end, separated by a blank line', () => {
    const envPath = path.join(workDir, '.env');
    fs.writeFileSync(envPath, 'EXISTING=1\n');

    upsertEnvFile(envPath, { NEW_ONE: 'a', NEW_TWO: 'b' });

    expect(fs.readFileSync(envPath, 'utf8')).toBe('EXISTING=1\n\nNEW_ONE=a\nNEW_TWO=b');
  });

  it('preserves comments and blank lines that are not updates', () => {
    const envPath = path.join(workDir, '.env');
    fs.writeFileSync(envPath, '# Header comment\n\nKEEP=1\n# trailing note\n');

    upsertEnvFile(envPath, { KEEP: '2' });

    expect(fs.readFileSync(envPath, 'utf8')).toBe('# Header comment\n\nKEEP=2\n# trailing note\n');
  });

  it('creates the file when it does not exist', () => {
    const envPath = path.join(workDir, '.env');
    expect(fs.existsSync(envPath)).toBe(false);

    upsertEnvFile(envPath, { A: '1', B: '2' });

    expect(fs.readFileSync(envPath, 'utf8')).toBe('A=1\nB=2');
  });

  it('is idempotent — running twice with the same input yields the same output', () => {
    const envPath = path.join(workDir, '.env');
    fs.writeFileSync(envPath, '# API_KEY=\nOTHER=keep\n');

    upsertEnvFile(envPath, { API_KEY: 'sk_x' });
    const once = fs.readFileSync(envPath, 'utf8');
    upsertEnvFile(envPath, { API_KEY: 'sk_x' });
    const twice = fs.readFileSync(envPath, 'utf8');

    expect(twice).toBe(once);
  });
});
