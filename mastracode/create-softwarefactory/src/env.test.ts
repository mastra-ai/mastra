import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EnvWriter, serializeValue } from './env.js';

const EXAMPLE = `# Sample env
# a comment
WORKOS_API_KEY=

GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
# MASTRACODE_PUBLIC_URL=
# APP_DATABASE_URL=
`;

let dir: string;
let envPath: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-env-'));
  envPath = path.join(dir, '.env');
  fs.writeFileSync(envPath, EXAMPLE);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('EnvWriter', () => {
  it('fills existing empty assignments in place, preserving comments and order', () => {
    const writer = new EnvWriter(envPath);
    writer.set('WORKOS_API_KEY', 'sk_test_123');
    writer.set('GITHUB_APP_ID', '42');
    writer.save();

    const content = fs.readFileSync(envPath, 'utf8');
    expect(content).toContain('# Sample env');
    expect(content).toContain('# a comment');
    expect(content.indexOf('WORKOS_API_KEY=sk_test_123')).toBeLessThan(content.indexOf('GITHUB_APP_ID=42'));
    // No duplicate assignments.
    expect(content.match(/^WORKOS_API_KEY=/gm)).toHaveLength(1);
  });

  it('uncomments `# KEY=` placeholders in place (unset vars ship commented out)', () => {
    const writer = new EnvWriter(envPath);
    writer.set('MASTRACODE_PUBLIC_URL', 'http://localhost:5173');
    writer.save();

    const content = fs.readFileSync(envPath, 'utf8');
    expect(content).toContain('MASTRACODE_PUBLIC_URL=http://localhost:5173');
    expect(content).not.toContain('# MASTRACODE_PUBLIC_URL=');
    // Untouched placeholders stay commented — no empty-string poisoning.
    expect(content).toContain('# APP_DATABASE_URL=');
    expect(content.match(/^MASTRACODE_PUBLIC_URL=/gm)).toHaveLength(1);
  });

  it('appends keys that are not present in the file', () => {
    const writer = new EnvWriter(envPath);
    writer.set('ANTHROPIC_API_KEY', 'sk-ant-xyz');
    writer.save();

    expect(fs.readFileSync(envPath, 'utf8')).toMatch(/\nANTHROPIC_API_KEY=sk-ant-xyz\n/);
  });

  it('replaces an already-set value instead of duplicating it', () => {
    const writer = new EnvWriter(envPath);
    writer.set('GITHUB_APP_ID', '1');
    writer.set('GITHUB_APP_ID', '2');
    writer.save();

    const content = fs.readFileSync(envPath, 'utf8');
    expect(content.match(/^GITHUB_APP_ID=/gm)).toHaveLength(1);
    expect(content).toContain('GITHUB_APP_ID=2');
  });

  it('escapes multi-line PEM values as \\n and quotes them', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nabc\ndef\n-----END RSA PRIVATE KEY-----\n';
    const writer = new EnvWriter(envPath);
    writer.set('GITHUB_APP_PRIVATE_KEY', pem);
    writer.save();

    const line = fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .find(l => l.startsWith('GITHUB_APP_PRIVATE_KEY='));
    expect(line).toBeDefined();
    expect(line).not.toContain('\nabc'); // single line
    expect(line).toContain('\\nabc\\ndef\\n');
    expect(line!.endsWith('"')).toBe(true);
  });

  it('tracks written keys for the outro summary', () => {
    const writer = new EnvWriter(envPath);
    writer.set('A', '1');
    writer.set('B', '2');
    writer.set('A', '3');
    expect(writer.keys().sort()).toEqual(['A', 'B']);
  });
});

describe('serializeValue', () => {
  it('leaves plain values untouched', () => {
    expect(serializeValue('sk-ant-123')).toBe('sk-ant-123');
    expect(serializeValue('postgres://user:pass@host:5432/db')).toBe('postgres://user:pass@host:5432/db');
  });

  it('quotes values with spaces or hash', () => {
    expect(serializeValue('a b')).toBe('"a b"');
    expect(serializeValue('a#b')).toBe('"a#b"');
  });

  it('escapes embedded double quotes', () => {
    expect(serializeValue('a"b')).toBe('"a\\"b"');
  });
});
