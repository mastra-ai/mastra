import { describe, expect, it } from 'vitest';

import { computeChangelogEntryWidth, fetchChangelog, parseChangelog } from '../update-check.js';

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
        '  • Added evals system for MastraCode.',
        '  • Fixed task lists leaking across threads.',
        '  • Allow typing a custom model string in `/om`.',
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

  it('truncates entries longer than the default cap', () => {
    const longEntry = 'A'.repeat(200);
    const md = `## 1.0.0\n\n- ${longEntry}`;
    const result = parseChangelog(md, '1.0.0')!;
    // "  • " prefix + 117 chars + "…" = well under 200
    expect(result.length).toBeLessThan(200);
    expect(result).toContain('…');
  });

  it('honors a wider maxEntryWidth so entries are not trimmed when there is space', () => {
    const longEntry = 'A'.repeat(140);
    const md = `## 1.0.0\n\n- ${longEntry}`;
    const result = parseChangelog(md, '1.0.0', { maxEntryWidth: 200 })!;
    expect(result).not.toContain('…');
    expect(result).toContain(longEntry);
  });

  it('truncates to the provided maxEntryWidth when narrower than the default', () => {
    const longEntry = 'A'.repeat(140);
    const md = `## 1.0.0\n\n- ${longEntry}`;
    const result = parseChangelog(md, '1.0.0', { maxEntryWidth: 50 })!;
    expect(result).toContain('…');
    // "  • " prefix (4) + 50 chars + "…" (1) = 55
    expect(result.length).toBe(55);
  });

  it('cuts at the first sentence when under 100 chars', () => {
    const md = '## 1.0.0\n\n- First sentence here. Then a longer explanation follows with details.';
    const result = parseChangelog(md, '1.0.0')!;
    expect(result).toContain('First sentence here.');
    expect(result).not.toContain('longer explanation');
  });

  it('still truncates a first sentence that exceeds the dialog width', () => {
    // A 95-char first sentence on a narrow terminal (cap=40) must still be
    // truncated so it does not overflow the dialog. Regression test for the
    // case where the first-sentence branch short-circuits the width cap.
    const longSentence = 'A'.repeat(94) + '.';
    const md = `## 1.0.0\n\n- ${longSentence} Trailing content.`;
    const result = parseChangelog(md, '1.0.0', { maxEntryWidth: 40 })!;
    expect(result).toContain('…');
    // "  • " prefix (4) + 40 chars + "…" (1) = 45
    expect(result.length).toBe(45);
  });
});

describe('computeChangelogEntryWidth', () => {
  it('returns a sane default when terminal width is unknown', () => {
    // Default cols = 120 → dialog = 108 → 108 - 8 = 100
    expect(computeChangelogEntryWidth(undefined)).toBe(100);
    expect(computeChangelogEntryWidth(0)).toBe(100);
  });

  it('scales with terminal width up to the 160-col modal cap', () => {
    // 80 cols → dialog = 72 → 72 - 8 = 64
    expect(computeChangelogEntryWidth(80)).toBe(64);
    // 160 cols → dialog = 144 → 144 - 8 = 136
    expect(computeChangelogEntryWidth(160)).toBe(136);
  });

  it('caps at the shared modal width (160 cols) on wide terminals', () => {
    // modalOverlayOptions caps dialog width at 160; entry cap = 160 - 8 = 152.
    expect(computeChangelogEntryWidth(200)).toBe(152);
    expect(computeChangelogEntryWidth(400)).toBe(152);
  });

  it('clamps to a minimum of 40 chars on tiny terminals', () => {
    expect(computeChangelogEntryWidth(20)).toBe(40);
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

  it('produces the expected exact output for a version with many entries (v0.10.0)', async () => {
    const result = await fetchChangelog('0.10.0');
    expect(result).toBe(
      [
        '  • Added a "Custom response..." option to questions with predefined choices.',
        '  • Added a /thread command to show the active thread, resource, and pending-new-thread state.',
        '  • Persist observational memory threshold settings across restarts and restore per-thread overrides.',
        '  • Improved Mastra Code prompt guidance so responses stay concise and terminal-friendly.',
        '  • Fixed provider name quoting in gateway sync to properly quote digit-leading provider IDs (e.g.',
        '  • Limit dynamically injected AGENTS.md reminders to 1000 estimated tokens by default and tell mastracode observational…',
        '  • Improved the Loaded AGENTS.md reminder in the TUI so it uses the new bordered notice style and collapses long reminde…',
        '  • Fixed the thread selector so it shows all threads consistently and opens faster.',
        '  • Custom slash commands now load correctly from all configured directories',
      ].join('\n'),
    );
  }, 10_000);

  it('returns null for a non-existent version', async () => {
    const result = await fetchChangelog('0.0.0-does-not-exist');
    expect(result).toBeNull();
  }, 10_000);
});
