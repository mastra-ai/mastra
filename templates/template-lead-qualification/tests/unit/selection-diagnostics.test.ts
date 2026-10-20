import { describe, expect, it } from 'vitest';
import { discoverySelectionSchema } from '../../src/mastra/research/contracts';
import { selectionDiagnosticUrl } from '../../src/mastra/observability/selection-diagnostics';

const candidate = {
  providerIndex: 0,
  url: 'https://example.com/team',
  priority: 8,
  rank: 1,
  selectionRank: 1,
  citationPreferred: false,
  selected: true,
  reason: 'retrieved',
};
describe('discovery diagnostic privacy contract', () => {
  it.each(['/.', '/..', '/%2e', '/%2e%2e', '/%2e%'])(
    'discards_truncated_dot_segments_that_would_change_when_reparsed: %s',
    ending => {
      const prefix = 'https://example.com/';
      const url = prefix + 'a'.repeat(512 - prefix.length - ending.length) + ending + 'suffix';
      expect(selectionDiagnosticUrl(url)).toBeNull();
    },
  );

  it('discards_unsafe_urls_and_keeps_only_bounded_public_https_host_path_prefixes', () => {
    for (const value of [
      'sensitive-marker',
      'file:///sensitive-marker',
      'http://example.com/sensitive-marker',
      'https://localhost/sensitive-marker',
      'https://service.local/sensitive-marker',
      'https://service.internal/sensitive-marker',
      'https://company.home/sensitive-marker',
      'https://company.lan/sensitive-marker',
      'https://company.onion/sensitive-marker',
      'https://127.0.0.1/sensitive-marker',
      'https://2130706433/sensitive-marker',
      'https://[::1]/sensitive-marker',
      'https://example.com:8080/sensitive-marker',
      'https://user:sensitive-marker@example.com/sensitive-marker',
    ])
      expect(selectionDiagnosticUrl(value)).toBeNull();
    expect(selectionDiagnosticUrl('https://EXAMPLE.com/team?token=sensitive-marker#sensitive-marker')).toBe(
      'https://example.com/team',
    );
    for (const path of ['a'.repeat(800), '%41'.repeat(300)]) {
      const url = selectionDiagnosticUrl(`https://example.com/${path}?secret=sensitive-marker`)!;
      expect(url.length).toBeLessThanOrEqual(512);
      expect(url).not.toContain('sensitive-marker');
      expect(url).not.toMatch(/%(?:[\da-f])?$/i);
      expect(selectionDiagnosticUrl(url)).toBe(url);
    }
  });
  it('rejects_unsafe_persisted_fields_unbounded_arrays_and_inconsistent_outcomes', () => {
    expect(discoverySelectionSchema.safeParse({ candidates: [candidate], omittedCount: 0 }).success).toBe(true);
    expect(
      discoverySelectionSchema.safeParse({
        candidates: [{ ...candidate, url: null, priority: null, rank: null }],
        omittedCount: 0,
      }).success,
    ).toBe(true);
    for (const patch of [
      { url: 'https://example.com/team?secret=sensitive-marker' },
      { url: 'https://service.local/private' },
      { url: 'https://user:secret@example.com/team' },
      { url: 'https://example.com/' + 'a'.repeat(512) },
      { reason: 'sensitive-marker' },
      { selected: false },
      { priority: null },
      { rank: null },
      { selectionRank: null },
      { extra: 'sensitive-marker' },
    ])
      expect(
        discoverySelectionSchema.safeParse({ candidates: [{ ...candidate, ...patch }], omittedCount: 0 }).success,
      ).toBe(false);
    expect(discoverySelectionSchema.safeParse({ candidates: Array(33).fill(candidate), omittedCount: 0 }).success).toBe(
      false,
    );
    expect(discoverySelectionSchema.safeParse({ candidates: [], omittedCount: -1 }).success).toBe(false);
  });
});
