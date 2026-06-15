import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { composeObservationExtractors, composeReflectionExtractors } from '../built-in-extractors';
import { applyExtractorHooks } from '../extracted-values';
import {
  Extractor,
  buildExtractorPriorLines,
  parseExtractedValues,
  parseExtractorValue,
  stripExtractorSections,
  validateExtractorList,
} from '../extractor';

describe('Extractor', () => {
  it('creates a structured carry-forward extractor by default', () => {
    const extractor = new Extractor({ name: 'Project Status', instructions: 'Extract the project status.' });

    expect(extractor.slug).toBe('project-status');
    expect(extractor.mode).toBe('structured');
    expect(extractor.injectionBehaviour).toBe('carry-forward');
    expect(extractor.schema.parse('active')).toBe('active');
  });

  it('rejects empty, duplicate, and reserved slugs', () => {
    expect(() => new Extractor({ name: '!!!', instructions: 'No usable slug.' })).toThrow(/non-empty slug/);
    expect(() => new Extractor({ name: 'current-task', instructions: 'Reserved.' })).toThrow(/reserved/);

    const first = new Extractor({ name: 'Priority', instructions: 'Extract priority.' });
    const second = new Extractor({ name: 'priority', instructions: 'Extract priority again.' });

    expect(() => validateExtractorList([first, second])).toThrow(/Duplicate extractor slug "priority"/);
  });

  it('parses string and JSON XML extractor values through Zod schemas', () => {
    const mood = new Extractor({ name: 'Mood', instructions: 'Extract mood.', mode: 'inline' });
    const details = new Extractor({
      name: 'Details',
      instructions: 'Extract details.',
      mode: 'inline',
      schema: z.object({ level: z.number(), tags: z.array(z.string()) }),
    });

    const parsed = parseExtractedValues(
      `<mood>focused</mood>\n<details>\n{"level":2,"tags":["memory","om"]}\n</details>`,
      [mood, details],
    );

    expect(parsed.values).toEqual({
      mood: 'focused',
      details: { level: 2, tags: ['memory', 'om'] },
    });
    expect(parsed.failures).toEqual([]);
  });

  it('reports schema failures without dropping valid extractor values', () => {
    const valid = new Extractor({ name: 'Valid', instructions: 'Extract valid.', mode: 'inline' });
    const count = new Extractor({ name: 'Count', instructions: 'Extract count.', mode: 'inline', schema: z.number() });

    const parsed = parseExtractedValues('<valid>\nok\n</valid>\n<count>\nnot-a-number\n</count>', [valid, count]);

    expect(parsed.values).toEqual({ valid: 'ok' });
    expect(parsed.failures).toHaveLength(1);
    expect(parsed.failures[0]?.slug).toBe('count');
    expect(parsed.failures[0]?.error).toMatch(/schema/);
  });

  it('strips extractor sections before observation parsing', () => {
    const status = new Extractor({ name: 'Status', instructions: 'Extract status.', mode: 'inline' });

    expect(stripExtractorSections('<observations>Keep me</observations>\n<status>\ndone\n</status>', [status])).toBe(
      '<observations>Keep me</observations>\n',
    );
  });

  it('validates raw values with JSON-first fallback for structured values', () => {
    const score = new Extractor({ name: 'Score', instructions: 'Extract score.', schema: z.number() });

    expect(parseExtractorValue(score, '7')).toBe(7);
    expect(() => parseExtractorValue(score, 'seven')).toThrow(/did not match/);
  });

  it('builds carry-forward prompt sections only for opted-in extractors with values', () => {
    const keep = new Extractor({ name: 'Keep', instructions: 'Keep it.', injectionBehaviour: 'carry-forward' });
    const skip = new Extractor({ name: 'Skip', instructions: 'Skip it.', injectionBehaviour: 'none' });

    expect(buildExtractorPriorLines([keep, skip], { keep: 'previous', skip: 'hidden' })).toEqual([
      '<keep>\nprevious\n</keep>',
    ]);
  });

  it('applies user hooks, validates returned values, and records hook failures', async () => {
    const okHook = vi.fn((context: { current: string }) => context.current.toUpperCase());
    const badHook = vi.fn((_context: { current: string }) => {
      throw new Error('hook failed');
    });
    const ok = new Extractor<string>({ name: 'Ok', instructions: 'Extract ok.', onExtracted: okHook });
    const bad = new Extractor<string>({ name: 'Bad', instructions: 'Extract bad.', onExtracted: badHook });

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [ok, bad],
      values: { ok: 'yes', bad: 'no' },
      previousValues: { ok: 'old' },
      threadId: 'thread-1',
      resourceId: 'resource-1',
    });

    expect(okHook).toHaveBeenCalledWith(expect.objectContaining({ previous: 'old', current: 'yes' }));
    expect(result.values).toEqual({ ok: 'YES' });
    expect(result.failures).toEqual([{ slug: 'bad', error: 'hook failed' }]);
  });

  it('composes enabled built-ins before user extractors', () => {
    const user = new Extractor({ name: 'Preference', instructions: 'Extract preference.' });

    expect(
      composeObservationExtractors({ threadTitle: true, extract: [user] }).map(extractor => extractor.slug),
    ).toEqual(['current-task', 'suggested-response', 'thread-title', 'preference']);
    expect(composeReflectionExtractors({ extract: [user] }).map(extractor => extractor.slug)).toEqual([
      'current-task',
      'suggested-response',
      'preference',
    ]);
  });
});
