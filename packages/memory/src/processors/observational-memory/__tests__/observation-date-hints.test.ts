import { describe, expect, it, vi } from 'vitest';
import { addObservationDateGaps, addRelativeTimeToObservations, buildObservationDateHints } from '../date-utils';

const now = new Date('2026-11-19T08:00:00Z');
const zone = 'America/Los_Angeles';

describe('separate observation date hints', () => {
  it.each(['dateless', 'sparse', 'date-heavy'])('resolves the observation calendar once for a large %s log', kind => {
    const text = Array.from({ length: 1000 }, (_, index) =>
      kind === 'date-heavy' || (kind === 'sparse' && index % 100 === 0)
        ? `- Fact ${index}: November 20, 2026`
        : `- Fact ${index}: User prefers concise answers`,
    ).join('\n');
    const calendar = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts');
    try {
      const hints = buildObservationDateHints(text, now, zone);
      expect(calendar.mock.calls.length).toBeLessThanOrEqual(1);
      if (kind === 'dateless') expect(hints).toBeUndefined();
      else expect(hints).toContain('November 20, 2026 (tomorrow)');
    } finally {
      calendar.mockRestore();
    }
  });

  it('preserves exact absolute text and only inserts static forward gaps', () => {
    const text =
      'Date: Mar 7-8, 2026\n- exact wording\n\nDate: Mar 15, 2026\n- next\nDate: Mar 14, 2026\nDate: Mar 15, 2026\nDate: March 16\nInline Date: Mar 23, 2026';
    expect(addObservationDateGaps(text)).toBe(
      text.replace('Date: Mar 15, 2026', '\n[1 week later]\n\nDate: Mar 15, 2026'),
    );
  });

  it('keeps range, meaning, estimated and free-text annotations equivalent to the existing formatter', () => {
    const lines = [
      'Date: Nov 17-18, 2026',
      '- User will travel (estimated November 18, 2026 at 3:00 PM)',
      '- User clarified (meaning November 20, 2026)',
      '- Exam on November 20, 2026',
      'Date: malformed',
      '- vague plans soon',
    ];
    const hints = buildObservationDateHints(lines.join('\n'), now, zone)!;
    for (const line of lines.slice(0, 4)) expect(hints).toContain(addRelativeTimeToObservations(line, now, zone));
    expect(hints).not.toContain('malformed');
    expect(hints).not.toContain('vague plans');
    expect(addObservationDateGaps(lines.join('\n'))).toBe(lines.join('\n'));
  });

  it('emits no hint for observations without parseable year-qualified dates', () => {
    expect(buildObservationDateHints('Date: March 18\n- User is happy\n- plans soon', now, zone)).toBeUndefined();
    expect(buildObservationDateHints('', now, zone)).toBeUndefined();
  });

  it('bounds repeated cues and oversized lines, retaining a current-day fallback', () => {
    const text = Array.from({ length: 300 }, (_, index) => `- Fact ${index}: November 20, 2026`).join('\n');
    const hints = buildObservationDateHints(text, now, zone)!;
    expect(hints.length).toBeLessThanOrEqual(8000);
    expect(hints.match(/Fact /g)).toHaveLength(64);
    expect(hints).toContain('Today is 2026-11-19');
    expect(hints).toContain('Additional date cues omitted');
    const oversized = buildObservationDateHints(`${'x'.repeat(20000)} November 20, 2026`, now, zone)!;
    expect(oversized.length).toBeLessThan(500);
    expect(oversized).toContain('Additional date cues omitted');
  });

  it('includes tags, the today explanation and omission notice in the 8,000-character suffix limit', () => {
    const hints = buildObservationDateHints(`${'x'.repeat(7900)} November 20, 2026`, now, zone)!;
    expect(hints.length).toBeLessThanOrEqual(8000);
    expect(hints).toContain('Today is 2026-11-19');
    expect(hints).toContain('Additional date cues omitted');
    expect(hints.endsWith('</observation-date-hints>')).toBe(true);
  });

  it('bounds combined cue length, not just the number of dates', () => {
    const hints = buildObservationDateHints(
      Array(64)
        .fill(`- ${'x'.repeat(500)} November 20, 2026`)
        .join('\n'),
      now,
      zone,
    )!;
    expect(hints.length).toBeLessThanOrEqual(8000);
    expect(hints).toContain('Additional date cues omitted');
  });

  it('uses record-local calendar days across spring-forward, independently of process time', () => {
    const text = 'Date: Mar 7, 2026\n- exact\nDate: Mar 14, 2026';
    expect(addObservationDateGaps(text)).toContain('[1 week later]');
    const before = buildObservationDateHints('Date: Mar 8, 2026', new Date('2026-03-09T06:59:59Z'), zone)!;
    const after = buildObservationDateHints('Date: Mar 8, 2026', new Date('2026-03-09T07:00:00Z'), zone)!;
    expect(before).toContain('Mar 8, 2026 (today)');
    expect(after).toContain('Mar 8, 2026 (yesterday)');
  });
});
