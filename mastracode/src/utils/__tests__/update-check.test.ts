import { afterEach, describe, expect, it } from 'vitest';

import { detectPackageManager, fetchChangelog, getCurrentVersion, getInstallCommand, isNewerVersion, parseChangelog } from '../update-check.js';

const testProcess = (globalThis as any).process as { env: Record<string, string | undefined> };
const ORIGINAL_ENV = { ...testProcess.env };

afterEach(() => {
  testProcess.env = { ...ORIGINAL_ENV };
});

describe('update-check helpers', () => {
  it.each([
    ['pnpm/10.0.0 npm/? node/?', 'pnpm'],
    ['yarn/1.22.22 npm/? node/?', 'yarn'],
    ['bun/1.2.0 npm/? node/?', 'bun'],
    ['npm/11.0.0 node/?', 'npm'],
  ] as const)('detects package manager from npm_config_user_agent=%s', async (userAgent, expected) => {
    testProcess.env.npm_config_user_agent = userAgent;
    delete testProcess.env.npm_execpath;
    delete testProcess.env.NODE_PATH;

    await expect(detectPackageManager()).resolves.toBe(expected);
  });

  it('falls back through npm_execpath and NODE_PATH before the default shell-out tier', async () => {
    delete testProcess.env.npm_config_user_agent;
    testProcess.env.npm_execpath = '/opt/homebrew/bin/yarn';
    delete testProcess.env.NODE_PATH;
    await expect(detectPackageManager()).resolves.toBe('yarn');

    delete testProcess.env.npm_execpath;
    testProcess.env.NODE_PATH = '/Users/test/.pnpm/global/5/node_modules';
    await expect(detectPackageManager()).resolves.toBe('pnpm');
  });

  it('builds install commands for each supported package manager', () => {
    expect(getInstallCommand('npm', '1.2.3')).toBe('npm install -g mastracode@1.2.3');
    expect(getInstallCommand('pnpm', '1.2.3')).toBe('pnpm add -g mastracode@1.2.3');
    expect(getInstallCommand('yarn', '1.2.3')).toBe('yarn global add mastracode@1.2.3');
    expect(getInstallCommand('bun', '1.2.3')).toBe('bun add -g mastracode@1.2.3');
  });

  it('resolves the source-run current version through the ESM-safe package metadata fallback', () => {
    expect(getCurrentVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('compares newer versions while ignoring prerelease suffixes', () => {
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(true);
    expect(isNewerVersion('1.2.3', '1.3.0')).toBe(true);
    expect(isNewerVersion('1.2.3', '2.0.0')).toBe(true);
    expect(isNewerVersion('1.2.3-alpha.0', '1.2.3-beta.0')).toBe(false);
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
  });
});

describe('parseChangelog', () => {
  const SAMPLE_CHANGELOG = [
    '# mastracode',
    '',
    '## 0.16.0',
    '',
    '### Minor Changes',
    '',
    '- Added evals system for MastraCode. ([#15642](https://github.com/mastra-ai/mastra/pull/15642))',
    '',
    '### Patch Changes',
    '',
    '- Fixed task lists leaking across threads. ([#15749](https://github.com/mastra-ai/mastra/pull/15749))',
    '',
    '- Allow typing a custom model string in `/om`. ([#15703](https://github.com/mastra-ai/mastra/pull/15703))',
    '',
    '- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b)]:',
    '  - @mastra/core@1.29.0',
    '  - @mastra/memory@1.17.2',
    '',
    '## 0.15.2',
    '',
    '### Patch Changes',
    '',
    '- Old bugfix from previous release. ([#15500](https://github.com/mastra-ai/mastra/pull/15500))',
  ].join('\n');

  it('produces the expected exact output for the sample changelog', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0');
    expect(result).toBe(
      [
        '  • Added evals system for MastraCode',
        '  • Fixed task lists leaking across threads',
        '  • Allow typing a custom model string in `/om`',
      ].join('\n'),
    );
  });

  it('does not include entries from other versions', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0');
    expect(result).not.toContain('Old bugfix');
  });

  it('filters out dependency update entries and their sub-items', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0');
    expect(result).not.toContain('Updated dependenc');
    expect(result).not.toContain('@mastra/core');
    expect(result).not.toContain('@mastra/memory');
  });

  it('strips markdown link syntax', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0')!;
    expect(result).not.toMatch(/\[.*\]\(.*\)/);
  });

  it('strips PR reference numbers', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0')!;
    expect(result).not.toMatch(/#\d{4,}/);
  });

  it('formats entries as bullet points', () => {
    const result = parseChangelog(SAMPLE_CHANGELOG, '0.16.0')!;
    const lines = result.split('\n');
    for (const line of lines) {
      expect(line).toMatch(/^\s+•\s+/);
    }
  });

  it('returns null for a version not in the changelog', () => {
    expect(parseChangelog(SAMPLE_CHANGELOG, '99.0.0')).toBeNull();
  });

  it('returns null when there are no meaningful entries', () => {
    const depOnly = ['## 1.0.0', '', '### Patch Changes', '', '- Updated dependencies:', '  - @mastra/core@2.0.0'].join(
      '\n',
    );
    expect(parseChangelog(depOnly, '1.0.0')).toBeNull();
  });

  it('preserves full entry text without truncation', () => {
    const longEntry = 'A'.repeat(200);
    const md = `## 1.0.0\n\n- ${longEntry}`;
    const result = parseChangelog(md, '1.0.0')!;
    expect(result).toContain('A'.repeat(200));
  });

  it('preserves full multi-sentence entries', () => {
    const md = '## 1.0.0\n\n- First sentence here. Then a longer explanation follows with details.';
    const result = parseChangelog(md, '1.0.0')!;
    expect(result).toContain('First sentence here. Then a longer explanation follows with details');
  });
});

describe('fetchChangelog (integration)', () => {
  it('fetches and parses the real changelog for a known published version', async () => {
    // v0.16.0 is a known published version with real changelog entries
    const result = await fetchChangelog('0.16.0');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');

    const lines = result!.split('\n');
    expect(lines.length).toBeGreaterThan(0);
    // Every line should be a bullet point
    for (const line of lines) {
      expect(line).toMatch(/^\s+•\s+/);
    }
    // Should contain at least one recognizable entry from v0.16.0
    expect(result).toContain('evals');
  }, 10_000);

  it('fetches and preserves full entries for a version with many entries (v0.10.0)', async () => {
    const result = await fetchChangelog('0.10.0');
    expect(result).not.toBeNull();
    const lines = result!.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(9);
    // Entries should not be truncated with "…"
    expect(result).toContain('Custom response');
    expect(result).toContain('/thread command');
    expect(result).toContain('observational memory');
    for (const line of lines) {
      expect(line).toMatch(/^\s+•\s+/);
    }
  }, 10_000);

  it('returns null for a non-existent version', async () => {
    const result = await fetchChangelog('0.0.0-does-not-exist');
    expect(result).toBeNull();
  }, 10_000);
});
