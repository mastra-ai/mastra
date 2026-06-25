import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { composeObservationExtractors, composeReflectionExtractors } from '../built-in-extractors';
import { applyExtractorHooks } from '../extracted-values';
import { extractStructuredValues } from '../extraction-runner';
import {
  Extractor,
  buildExtractorOutputSections,
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

  it('parses combined inline JSON extractor values through Zod schemas', () => {
    const mood = new Extractor({ name: 'Mood', instructions: 'Extract mood.', mode: 'inline' });
    const details = new Extractor({
      name: 'Details',
      instructions: 'Extract details.',
      mode: 'inline',
      schema: z.object({ level: z.number(), tags: z.array(z.string()) }),
    });

    const parsed = parseExtractedValues(
      `<extracted-values>\n{"mood":"focused","details":{"level":2,"tags":["memory","om"]}}\n</extracted-values>`,
      [mood, details],
    );

    expect(parsed.values).toEqual({
      mood: 'focused',
      details: { level: 2, tags: ['memory', 'om'] },
    });
    expect(parsed.failures).toEqual([]);
  });

  it('reports schema failures without dropping valid combined inline extractor values', () => {
    const valid = new Extractor({ name: 'Valid', instructions: 'Extract valid.', mode: 'inline' });
    const count = new Extractor({ name: 'Count', instructions: 'Extract count.', mode: 'inline', schema: z.number() });

    const parsed = parseExtractedValues(
      '<extracted-values>\n{"valid":"ok","count":"not-a-number"}\n</extracted-values>',
      [valid, count],
    );

    expect(parsed.values).toEqual({ valid: 'ok' });
    expect(parsed.failures).toHaveLength(1);
    expect(parsed.failures[0]?.slug).toBe('count');
    expect(parsed.failures[0]?.error).toMatch(/expected number/);
  });

  it('strips combined inline extractor sections before observation parsing', () => {
    const status = new Extractor({ name: 'Status', instructions: 'Extract status.', mode: 'inline' });

    expect(
      stripExtractorSections(
        '<observations>Keep me</observations>\n<extracted-values>\n{"status":"done"}\n</extracted-values>',
        [status],
      ),
    ).toBe('<observations>Keep me</observations>\n');
  });

  it('validates raw values with JSON-first fallback for structured values', () => {
    const score = new Extractor({ name: 'Score', instructions: 'Extract score.', schema: z.number() });

    expect(parseExtractorValue(score, '7')).toBe(7);
    expect(() => parseExtractorValue(score, 'seven')).toThrow(/did not match/);
  });

  it('builds one combined inline output section with schema guidance', () => {
    const location = new Extractor({
      name: 'Weather Locations',
      instructions: 'Extract requested weather locations.',
      mode: 'inline',
      schema: z.array(z.string()),
    });
    const mood = new Extractor({ name: 'Mood', instructions: 'Extract mood.', mode: 'inline' });

    const section = buildExtractorOutputSections([location, mood]);

    expect(section).toContain('Extract these values into a single JSON object keyed by extractor slug:');
    expect(section).toContain('- weather-locations (Weather Locations): Extract requested weather locations.');
    expect(section).toContain('- mood (Mood): Extract mood.');
    expect(section).toContain('"weather-locations"');
    expect(section).toContain('"type": "array"');
    expect(section).toContain('"type": "string"');
    expect(section).toContain(
      '<extracted-values>\nWrite only the extracted values JSON object here.\n</extracted-values>',
    );
    expect(section).not.toContain('<weather-locations>');
  });

  it('ignores copied combined inline output placeholders', () => {
    const location = new Extractor({
      name: 'Weather Locations',
      instructions: 'Extract requested weather locations.',
      mode: 'inline',
    });

    const parsed = parseExtractedValues(
      '<extracted-values>\nWrite only the extracted values JSON object here.\n</extracted-values>',
      [location],
    );

    expect(parsed.values).toEqual({});
    expect(parsed.failures).toEqual([]);
  });

  it('builds carry-forward prompt sections only for opted-in extractors with values', () => {
    const keep = new Extractor({ name: 'Keep', instructions: 'Keep it.', injectionBehaviour: 'carry-forward' });
    const skip = new Extractor({ name: 'Skip', instructions: 'Skip it.', injectionBehaviour: 'none' });

    expect(buildExtractorPriorLines([keep, skip], { keep: 'previous', skip: 'hidden' })).toEqual([
      '<keep>\nprevious\n</keep>',
    ]);
  });

  it('returns extractor failures when the structured extraction call fails', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    const profile = new Extractor({
      name: 'Profile',
      instructions: 'Extract profile.',
      schema: z.object({ tier: z.string() }),
    });
    const agent = new Agent({
      id: 'structured-extraction-failure-test',
      name: 'Structured Extraction Failure Test',
      instructions: 'Extract values.',
      model: new MockLanguageModelV2({
        doGenerate: async () => {
          throw new Error('structured call failed');
        },
      }),
    });

    const result = await extractStructuredValues({
      agent,
      source: 'observer',
      extractors: [priority, profile],
    });

    expect(result.values).toEqual({});
    expect(result.failures).toEqual([
      { slug: 'priority', error: 'structured call failed' },
      { slug: 'profile', error: 'structured call failed' },
    ]);
  });

  it('uses a direct extraction-only prompt for structured observer follow-up calls', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    let prompt = '';
    const agent = new Agent({
      id: 'structured-extraction-memory-test',
      name: 'Structured Extraction Memory Test',
      instructions: 'Extract values.',
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt: modelPrompt }) => {
          prompt = JSON.stringify(modelPrompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            content: [{ type: 'text', text: '{"priority":"high"}' }],
            warnings: [],
          };
        },
      }),
    });

    const result = await extractStructuredValues({
      agent,
      source: 'observer',
      extractors: [priority],
    });

    expect(result.values).toEqual({ priority: 'high' });
    expect(prompt).toContain('Extract structured data from the observations you made.');
    expect(prompt).toContain('Do not write observations, XML, markdown, or explanatory text.');
    expect(prompt).not.toContain('previous assistant message');
    expect(prompt).not.toContain('## Source Output');
    expect(prompt).not.toContain('## Parsed Observations');
    expect(prompt).not.toContain('<observations>');
    expect(prompt).not.toContain('<thread-title>');
  });

  it('uses direct reflection wording for structured reflector follow-up calls', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    let prompt = '';
    const agent = new Agent({
      id: 'structured-reflection-extraction-test',
      name: 'Structured Reflection Extraction Test',
      instructions: 'Extract values.',
      model: new MockLanguageModelV2({
        doGenerate: async ({ prompt: modelPrompt }) => {
          prompt = JSON.stringify(modelPrompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            content: [{ type: 'text', text: '{"priority":"high"}' }],
            warnings: [],
          };
        },
      }),
    });

    const result = await extractStructuredValues({
      agent,
      source: 'reflector',
      extractors: [priority],
    });

    expect(result.values).toEqual({ priority: 'high' });
    expect(prompt).toContain('Extract structured data from the reflection you made.');
    expect(prompt).not.toContain('previous assistant message');
    expect(prompt).not.toContain('## Source Output');
    expect(prompt).not.toContain('## Parsed Observations');
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
