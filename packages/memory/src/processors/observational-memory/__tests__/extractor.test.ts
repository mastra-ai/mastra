import { Agent } from '@mastra/core/agent';
import { coreFeatures } from '@mastra/core/features';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { composeObservationExtractors, composeReflectionExtractors } from '../built-in-extractors';
import {
  applyExtractorHooks,
  buildThreadMetadataFromExtractedValues,
  getPriorExtractedValues,
} from '../extracted-values';
import { extractStructuredValues } from '../extraction-runner';
import {
  Extractor,
  buildExtractorOutputSections,
  buildExtractorPriorLines,
  parseExtractedValues,
  parseExtractorValue,
  resolveExtractors,
  slugifyExtractorName,
  stripExtractorSections,
  validateExtractorList,
} from '../extractor';
import { WorkingMemoryExtractor } from '../working-memory-extractor';

describe('Extractor', () => {
  it('creates an inline string carry-forward extractor when no schema is provided', () => {
    const extractor = new Extractor({ name: 'Project Status', instructions: 'Extract the project status.' });

    expect(extractor.slug).toBe('project-status');
    expect(extractor.mode).toBe('inline');
    expect(extractor.includePreviousExtraction).toBe(true);
    expect(extractor.metadataKeyPath).toBe('extracted.project-status');
    expect(extractor.schema.parse('active')).toBe('active');
  });

  it('creates a structured carry-forward extractor when a schema is provided', () => {
    const extractor = new Extractor({
      name: 'Project Status',
      instructions: 'Extract the project status.',
      schema: z.object({ status: z.string() }),
    });

    expect(extractor.mode).toBe('structured');
  });

  it('trims repeated slug separators without regex backtracking', () => {
    expect(slugifyExtractorName('---Project---Status---')).toBe('project-status');
  });

  it('routes extracted values through string metadata key paths', () => {
    const priority = new Extractor({
      name: 'Priority',
      instructions: 'Extract priority.',
      metadataKeyPath: 'extracted.priority',
    });
    const title = new Extractor({
      name: 'Title',
      instructions: 'Extract title.',
      metadataKeyPath: 'threadTitle',
    });
    const transient = new Extractor({
      name: 'Transient',
      instructions: 'Extract transient value.',
      metadataKeyPath: false,
    });

    const metadata = buildThreadMetadataFromExtractedValues([priority, title, transient], {
      priority: 'high',
      title: 'Metadata Routing',
      transient: 'marker-only',
    });

    expect(metadata).toEqual({
      threadTitle: 'Metadata Routing',
      extracted: { priority: 'high' },
    });
    expect(getPriorExtractedValues(metadata, [priority, title, transient])).toEqual({
      priority: 'high',
      title: 'Metadata Routing',
    });
  });

  it('rejects unsafe metadata key path segments', () => {
    const extractor = new Extractor({
      name: 'Unsafe',
      instructions: 'Extract unsafe value.',
      metadataKeyPath: '__proto__.polluted',
    });

    expect(() => buildThreadMetadataFromExtractedValues([extractor], { unsafe: 'yes' })).toThrow(/unsafe path segment/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects empty, duplicate, and reserved slugs', () => {
    expect(() => new Extractor({ name: '!!!', instructions: 'No usable slug.' })).toThrow(/non-empty slug/);
    expect(() => new Extractor({ name: 'current-task', instructions: 'Reserved.' })).toThrow(/reserved/);

    const first = new Extractor({ name: 'Priority', instructions: 'Extract priority.' });
    const second = new Extractor({ name: 'priority', instructions: 'Extract priority again.' });

    expect(() => validateExtractorList([first, second])).toThrow(/Duplicate extractor slug "priority"/);
  });

  it('parses combined inline JSON string extractor values', () => {
    const mood = new Extractor({ name: 'Mood', instructions: 'Extract mood.' });
    const details = new Extractor({ name: 'Details', instructions: 'Extract details.' });

    const parsed = parseExtractedValues(
      `<extracted-values>\n{"mood":"focused","details":"memory and om"}\n</extracted-values>`,
      [mood, details],
    );

    expect(parsed.values).toEqual({
      mood: 'focused',
      details: 'memory and om',
    });
    expect(parsed.failures).toEqual([]);
  });

  it('parses legacy per-extractor XML tags for schema-less inline values', () => {
    const userInfo = new Extractor({ name: 'User info', instructions: 'Extract user details.' });

    const parsed = parseExtractedValues(
      '<observations>User shared their name.</observations>\n<user-info>name: Tyler</user-info>',
      [userInfo],
    );

    expect(parsed.values).toEqual({ 'user-info': 'name: Tyler' });
    expect(parsed.failures).toEqual([]);
  });

  it('ignores structured extractors when parsing inline extracted values', () => {
    const valid = new Extractor({ name: 'Valid', instructions: 'Extract valid.' });
    const count = new Extractor({ name: 'Count', instructions: 'Extract count.', schema: z.number() });

    const parsed = parseExtractedValues(
      '<extracted-values>\n{"valid":"ok","count":"not-a-number"}\n</extracted-values>',
      [valid, count],
    );

    expect(parsed.values).toEqual({ valid: 'ok' });
    expect(parsed.failures).toEqual([]);
  });

  it('strips inline extractor sections before observation parsing', () => {
    const status = new Extractor({ name: 'Status', instructions: 'Extract status.' });

    expect(
      stripExtractorSections(
        '<observations>Keep me</observations>\n<extracted-values>\n{"status":"done"}\n</extracted-values>\n<status>done</status>',
        [status],
      ),
    ).toBe('<observations>Keep me</observations>\n');
  });

  it('validates raw values with JSON-first fallback for structured values', () => {
    const score = new Extractor({ name: 'Score', instructions: 'Extract score.', schema: z.number() });

    expect(parseExtractorValue(score, '7')).toBe(7);
    expect(() => parseExtractorValue(score, 'seven')).toThrow(/did not match/);
  });

  it('builds per-extractor inline output sections for schema-less string extractors', () => {
    const location = new Extractor({
      name: 'Weather Locations',
      instructions: 'Extract requested weather locations.',
      schema: z.array(z.string()),
    });
    const mood = new Extractor({ name: 'Mood', instructions: 'Extract mood.' });

    const section = buildExtractorOutputSections([location, mood]);

    expect(section).toContain('Additional optional XML sections:');
    expect(section).toContain('If the observations include information relevant to any of these tags');
    expect(section).not.toContain('<weather-locations>');
    expect(section).toContain('<mood>');
    expect(section).toContain('Extract mood.');
    expect(section).toContain('Include this section when the observations contain relevant information for <mood>.');
    expect(section).not.toContain('<extracted-values>');
  });

  it('ignores copied combined inline output placeholders', () => {
    const location = new Extractor({
      name: 'Weather Locations',
      instructions: 'Extract requested weather locations.',
    });

    const parsed = parseExtractedValues(
      '<extracted-values>\nWrite only the extracted values JSON object here.\n</extracted-values>',
      [location],
    );

    expect(parsed.values).toEqual({});
    expect(parsed.failures).toEqual([]);
  });

  it('builds previous extraction prompt sections only for opted-in extractors with values', () => {
    const keep = new Extractor({ name: 'Keep', instructions: 'Keep it.' });
    const skip = new Extractor({ name: 'Skip', instructions: 'Skip it.', includePreviousExtraction: false });

    expect(buildExtractorPriorLines([keep, skip], { keep: 'previous', skip: 'hidden' })).toEqual([
      '<keep>\nprevious\n</keep>',
    ]);
  });

  it('resolves dynamic instructions and schemas with runtime context', async () => {
    const schema = z.object({ memoryEnabled: z.boolean() });
    const memory = { marker: 'active-memory' } as any;
    const extractor = new Extractor({
      name: 'Working Memory Draft',
      instructions: context => `Use ${context.memory === memory ? 'active' : 'missing'} memory for ${context.source}.`,
      schema: context => (context.memory === memory ? schema : undefined),
    });

    const [resolved] = await resolveExtractors([extractor], { source: 'observer', memory });

    expect(resolved?.instructions).toBe('Use active memory for observer.');
    expect(resolved?.mode).toBe('structured');
    expect(resolved?.schema).toBe(schema);
    expect(buildExtractorOutputSections([resolved!])).toBe('');
  });

  it('passes the active memory instance to extractor hooks', async () => {
    const onExtracted = vi.fn((_context: { memory?: unknown }) => undefined);
    const memory = { marker: 'active-memory' } as any;
    const extractor = new Extractor({ name: 'Hook', instructions: 'Extract hook.', onExtracted });

    await applyExtractorHooks({
      source: 'observer',
      extractors: [extractor],
      values: { hook: 'value' },
      threadId: 'thread-1',
      memory,
    });

    expect(onExtracted).toHaveBeenCalledWith(expect.objectContaining({ memory }));
  });

  it('updates markdown working memory from the working memory extractor without persisting OM metadata', async () => {
    const memory = {
      getMergedThreadConfig: vi.fn(() => ({ workingMemory: { enabled: true } })),
      getWorkingMemoryTemplate: vi.fn(async () => ({ format: 'markdown', content: '# User\n' })),
      getWorkingMemory: vi.fn(async () => '- Existing fact'),
      updateWorkingMemory: vi.fn(async () => undefined),
    } as any;
    const extractor = new WorkingMemoryExtractor();
    const [resolved] = await resolveExtractors([extractor], {
      source: 'observer',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      memory,
    });

    expect(resolved?.instructions).toContain('Current working memory:\n- Existing fact');

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [resolved!],
      values: { 'working-memory': '# User\n- Existing fact\n- New fact' },
      threadId: 'thread-1',
      resourceId: 'resource-1',
      memory,
    });

    expect(memory.updateWorkingMemory).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      workingMemory: '# User\n- Existing fact\n- New fact',
      memoryConfig: undefined,
    });
    expect(result.values).toEqual({ 'working-memory': '# User\n- Existing fact\n- New fact' });
    expect(buildThreadMetadataFromExtractedValues([resolved!], result.values)).toEqual({});
  });

  it('replaces JSON working memory from the working memory extractor', async () => {
    const memory = {
      getMergedThreadConfig: vi.fn(() => ({ workingMemory: { enabled: true, schema: {} } })),
      getWorkingMemoryTemplate: vi.fn(async () => ({ format: 'json', content: '{"type":"object"}' })),
      getWorkingMemory: vi.fn(async () => '{"name":"Tyler","likes":["dogs"]}'),
      updateWorkingMemory: vi.fn(async () => undefined),
    } as any;
    const extractor = new WorkingMemoryExtractor();
    const [resolved] = await resolveExtractors([extractor], {
      source: 'observer',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      memory,
    });

    expect(resolved?.mode).toBe('structured');
    expect(resolved?.instructions).toContain('Working memory JSON schema:');
    expect(resolved?.schema.parse({ location: 'Toronto' })).toEqual({ location: 'Toronto' });
    expect(resolved?.schema.parse(null)).toBeNull();
    expect(buildExtractorOutputSections([resolved!])).toBe('');

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [resolved!],
      values: { 'working-memory': { location: 'Toronto' } },
      threadId: 'thread-1',
      resourceId: 'resource-1',
      memory,
    });

    expect(memory.updateWorkingMemory).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      workingMemory: JSON.stringify({ location: 'Toronto' }),
      memoryConfig: undefined,
    });
    expect(result.values).toEqual({ 'working-memory': { location: 'Toronto' } });
    expect(buildThreadMetadataFromExtractedValues([resolved!], result.values)).toEqual({});
  });

  it('skips JSON working memory updates when the extractor returns null', async () => {
    const memory = {
      getMergedThreadConfig: vi.fn(() => ({ workingMemory: { enabled: true, schema: {} } })),
      getWorkingMemoryTemplate: vi.fn(async () => ({ format: 'json', content: '{"type":"object"}' })),
      getWorkingMemory: vi.fn(async () => '{"name":"Tyler"}'),
      updateWorkingMemory: vi.fn(async () => undefined),
    } as any;
    const extractor = new WorkingMemoryExtractor();
    const [resolved] = await resolveExtractors([extractor], {
      source: 'observer',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      memory,
    });

    const result = await applyExtractorHooks({
      source: 'observer',
      extractors: [resolved!],
      values: { 'working-memory': null },
      threadId: 'thread-1',
      resourceId: 'resource-1',
      memory,
    });

    expect(memory.updateWorkingMemory).not.toHaveBeenCalled();
    expect(result.values).toBeUndefined();
  });

  describe('configured working memory schema', () => {
    const preferencesSchema = z.strictObject({
      preferredColor: z.enum(['blue', 'green']),
      budget: z.number().nullable(),
    });

    function createSchemaMemory(schema: unknown) {
      return {
        getMergedThreadConfig: vi.fn(() => ({ workingMemory: { enabled: true, schema } })),
        getWorkingMemoryTemplate: vi.fn(async () => ({ format: 'json', content: '{"type":"object"}' })),
        getWorkingMemory: vi.fn(async () => '{"preferredColor":"blue","budget":100}'),
        updateWorkingMemory: vi.fn(async () => undefined),
      } as any;
    }

    async function resolveWorkingMemoryExtractor(memory: any) {
      const [resolved] = await resolveExtractors([new WorkingMemoryExtractor()], {
        source: 'observer',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        memory,
      });
      return resolved!;
    }

    async function applyWorkingMemoryValue(memory: any, value: unknown) {
      const resolved = await resolveWorkingMemoryExtractor(memory);
      return applyExtractorHooks({
        source: 'observer',
        extractors: [resolved],
        values: { 'working-memory': value },
        threadId: 'thread-1',
        resourceId: 'resource-1',
        memory,
      });
    }

    it('uses the configured schema as the structured extraction schema', async () => {
      const resolved = await resolveWorkingMemoryExtractor(createSchemaMemory(preferencesSchema));
      const jsonSchema = JSON.stringify(z.toJSONSchema(resolved.schema));

      expect(jsonSchema).toContain('preferredColor');
      expect(jsonSchema).toContain('"green"');
      expect(resolved.schema.safeParse(null).success).toBe(true);
    });

    it('persists a valid document', async () => {
      const memory = createSchemaMemory(preferencesSchema);
      await applyWorkingMemoryValue(memory, { preferredColor: 'green', budget: 200 });

      expect(memory.updateWorkingMemory).toHaveBeenCalledWith(
        expect.objectContaining({ workingMemory: JSON.stringify({ preferredColor: 'green', budget: 200 }) }),
      );
    });

    it.each([
      ['an invalid enum value', { preferredColor: 'red', budget: 200 }],
      ['a wrong field type', { preferredColor: 'green', budget: '200' }],
      ['a missing required field', { preferredColor: 'green' }],
      ['an unknown key', { preferredColor: 'green', budget: 200, mood: 'happy' }],
    ])('rejects %s', async (_label, value) => {
      const memory = createSchemaMemory(preferencesSchema);
      const resolved = await resolveWorkingMemoryExtractor(memory);

      expect(resolved.schema.safeParse(value).success).toBe(false);

      await applyWorkingMemoryValue(memory, value);
      expect(memory.updateWorkingMemory).not.toHaveBeenCalled();
    });

    it('enforces JSON Schema working memory configs', async () => {
      const memory = createSchemaMemory({
        type: 'object',
        properties: { preferredColor: { type: 'string', enum: ['blue', 'green'] } },
        required: ['preferredColor'],
        additionalProperties: false,
      });
      const resolved = await resolveWorkingMemoryExtractor(memory);

      expect(resolved.schema.safeParse({ preferredColor: 'red' }).success).toBe(false);
      expect(resolved.schema.safeParse({ preferredColor: 'blue' }).success).toBe(true);

      await applyWorkingMemoryValue(memory, { preferredColor: 'red' });
      expect(memory.updateWorkingMemory).not.toHaveBeenCalled();

      await applyWorkingMemoryValue(memory, { preferredColor: 'blue' });
      expect(memory.updateWorkingMemory).toHaveBeenCalledTimes(1);
    });

    it("uses a Standard Schema's own validator before saving", async () => {
      const jsonSchema = {
        type: 'object',
        properties: { budget: { type: 'number' } },
        required: ['budget'],
        additionalProperties: false,
      };
      // The validator enforces a rule (budget <= 100) that its JSON Schema doesn't express.
      const memory = createSchemaMemory({
        '~standard': {
          version: 1,
          vendor: 'test',
          validate: (value: unknown) =>
            (value as { budget: number }).budget <= 100
              ? { value }
              : { issues: [{ message: 'budget too high', path: ['budget'] }] },
          jsonSchema: { input: () => jsonSchema, output: () => jsonSchema },
        },
      } as any);
      const resolved = await resolveWorkingMemoryExtractor(memory);

      expect(resolved.schema.safeParse({ budget: 500 }).success).toBe(true);

      await applyWorkingMemoryValue(memory, { budget: 500 });
      expect(memory.updateWorkingMemory).not.toHaveBeenCalled();

      await applyWorkingMemoryValue(memory, { budget: 50 });
      expect(memory.updateWorkingMemory).toHaveBeenCalledTimes(1);
    });
  });

  it('returns extractor failures when the structured extraction call fails', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    const profile = new Extractor({
      name: 'Profile',
      instructions: 'Extract profile.',
      schema: z.object({ tier: z.string() }),
    });
    const agent = {
      stream: vi.fn().mockRejectedValue(new Error('structured call failed')),
    } as unknown as Agent<any, any, any, any>;

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

  it('retries streamed structured extraction with inline json prompt injection when native output throws', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    const stream = vi
      .fn()
      .mockRejectedValueOnce(new Error('native failed'))
      .mockResolvedValueOnce({ object: Promise.resolve({ priority: 'high' }) });

    const result = await extractStructuredValues({
      agent: { stream } as unknown as Agent<any, any, any, any>,
      source: 'observer',
      extractors: [priority],
    });

    expect(result.values).toEqual({ priority: 'high' });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream.mock.calls[0][1].structuredOutput.jsonPromptInjection).toBeUndefined();
    expect(stream.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe('inline');
  });

  it('uses streaming for structured extraction', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    const generate = vi.fn();
    const stream = vi.fn().mockResolvedValueOnce({ object: Promise.resolve({ priority: 'high' }) });

    const result = await extractStructuredValues({
      agent: { generate, stream } as unknown as Agent<any, any, any, any>,
      source: 'observer',
      extractors: [priority],
    });

    expect(result).toEqual({ values: { priority: 'high' }, failures: [] });
    expect(generate).not.toHaveBeenCalled();
    expect(stream).toHaveBeenCalledTimes(1);
    expect(stream.mock.calls[0][1].structuredOutput.jsonPromptInjection).toBeUndefined();
  });

  it('retries structured extraction with inline json prompt injection when native output has no object', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    const stream = vi
      .fn()
      .mockResolvedValueOnce({ object: Promise.resolve(undefined) })
      .mockResolvedValueOnce({ object: Promise.resolve({ priority: 'medium' }) });

    const result = await extractStructuredValues({
      agent: { stream } as unknown as Agent<any, any, any, any>,
      source: 'observer',
      extractors: [priority],
    });

    expect(result.values).toEqual({ priority: 'medium' });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe('inline');
  });

  it('retries schema working-memory extraction when native output is an empty object', async () => {
    const memory = {
      getMergedThreadConfig: vi.fn(() => ({ workingMemory: { enabled: true, schema: {} } })),
      getWorkingMemoryTemplate: vi.fn(async () => ({ format: 'json', content: '{"type":"object"}' })),
      getWorkingMemory: vi.fn(async () => '{"preferences":{}}'),
    } as any;
    const extractor = new WorkingMemoryExtractor();
    const [resolved] = await resolveExtractors([extractor], {
      source: 'observer',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      memory,
    });
    const stream = vi
      .fn()
      .mockResolvedValueOnce({ object: Promise.resolve({}) })
      .mockResolvedValueOnce({
        object: Promise.resolve({ 'working-memory': { preferences: { responseStyle: 'concise' } } }),
      });

    const result = await extractStructuredValues({
      agent: { stream } as unknown as Agent<any, any, any, any>,
      source: 'observer',
      extractors: [resolved!],
    });

    expect(result.values).toEqual({ 'working-memory': { preferences: { responseStyle: 'concise' } } });
    expect(result.failures).toEqual([]);
    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream.mock.calls[0][1].structuredOutput.jsonPromptInjection).toBeUndefined();
    expect(stream.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe('inline');
  });

  it('falls back to system json prompt injection when inline support is not advertised', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    const stream = vi
      .fn()
      .mockRejectedValueOnce(new Error('native failed'))
      .mockResolvedValueOnce({ object: Promise.resolve({ priority: 'low' }) });

    coreFeatures.delete('json-prompt-injection:inline');
    try {
      const result = await extractStructuredValues({
        agent: { stream } as unknown as Agent<any, any, any, any>,
        source: 'observer',
        extractors: [priority],
      });

      expect(result.values).toEqual({ priority: 'low' });
      expect(stream.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
    } finally {
      coreFeatures.add('json-prompt-injection:inline');
    }
  });

  it('rethrows abort errors without retrying structured extraction', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    const abortSignal = AbortSignal.abort();
    const stream = vi.fn().mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

    await expect(
      extractStructuredValues({
        agent: { stream } as unknown as Agent<any, any, any, any>,
        source: 'observer',
        extractors: [priority],
        abortSignal,
      }),
    ).rejects.toThrow(/aborted/);

    expect(stream).toHaveBeenCalledTimes(1);
  });

  it('uses a direct extraction-only prompt for structured observer follow-up calls', async () => {
    const priority = new Extractor({ name: 'Priority', instructions: 'Extract priority.', schema: z.string() });
    let prompt = '';
    const agent = {
      stream: vi.fn(async (streamPrompt: string) => {
        prompt = streamPrompt;
        return { object: Promise.resolve({ priority: 'high' }) };
      }),
    } as unknown as Agent<any, any, any, any>;

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
    const agent = {
      stream: vi.fn(async (streamPrompt: string) => {
        prompt = streamPrompt;
        return { object: Promise.resolve({ priority: 'high' }) };
      }),
    } as unknown as Agent<any, any, any, any>;

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
