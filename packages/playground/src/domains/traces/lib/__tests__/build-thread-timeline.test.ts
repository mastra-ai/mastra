import { describe, expect, it } from 'vitest';

import { buildThreadTimeline, extractUserTurn, type TimelineSpan } from '../build-thread-timeline';

const span = (partial: Partial<TimelineSpan> & { spanId: string }): TimelineSpan => partial;

describe('extractUserTurn', () => {
  it('reads a plain string input', () => {
    expect(extractUserTurn('What is the weather?')).toBe('What is the weather?');
  });

  it('reads the last user message of a messages array', () => {
    expect(
      extractUserTurn([
        { role: 'system', content: 'tu es un chef' },
        { role: 'user', content: 'Que puis-je cuisiner ?' },
      ]),
    ).toBe('Que puis-je cuisiner ?');
  });

  it('reads content parts', () => {
    expect(extractUserTurn([{ role: 'user', content: [{ type: 'text', text: 'Bonjour' }] }])).toBe('Bonjour');
  });

  it('reads a wrapped { messages } input', () => {
    expect(extractUserTurn({ messages: ['Salut'] })).toBe('Salut');
  });

  it('returns undefined on unusable input', () => {
    expect(extractUserTurn(undefined)).toBeUndefined();
    expect(extractUserTurn({ resumeData: 42 })).toBeUndefined();
  });
});

describe('buildThreadTimeline', () => {
  const spans: TimelineSpan[] = [
    span({
      spanId: 'root',
      spanType: 'agent_run',
      input: [{ role: 'user', content: 'Bonjour' }],
      startedAt: '2026-01-01T10:00:00Z',
    }),
    span({ spanId: 'chunk', spanType: 'model_chunk', parentSpanId: 'root', startedAt: '2026-01-01T10:00:01Z' }),
    span({ spanId: 'tool', spanType: 'tool_call', parentSpanId: 'root', startedAt: '2026-01-01T10:00:03Z' }),
    span({ spanId: 'gen', spanType: 'model_generation', parentSpanId: 'root', startedAt: '2026-01-01T10:00:02Z' }),
    span({ spanId: 'step', spanType: 'model_step', parentSpanId: 'gen', startedAt: '2026-01-01T10:00:02Z' }),
  ];

  it('extracts the user turn from the root agent_run span', () => {
    expect(buildThreadTimeline(spans).userTurn).toBe('Bonjour');
  });

  it('keeps only allowlisted spans, in chronological order', () => {
    expect(buildThreadTimeline(spans).entries.map(entry => entry.spanId)).toEqual(['gen', 'tool']);
  });

  it('degrades gracefully on empty input', () => {
    expect(buildThreadTimeline(undefined)).toEqual({ userTurn: undefined, entries: [] });
  });
});

describe('infrastructure processors', () => {
  const infra: TimelineSpan[] = [
    span({ spanId: 'root', spanType: 'agent_run', input: 'Salut', startedAt: '2026-01-01T10:00:00Z' }),
    span({ spanId: 'p1', spanType: 'processor_run', entityId: 'task-state', startedAt: '2026-01-01T10:00:01Z' }),
    span({
      spanId: 'p2',
      spanType: 'processor_run',
      name: 'input processor: Observational Memory',
      startedAt: '2026-01-01T10:00:02Z',
    }),
    span({
      spanId: 'p3',
      spanType: 'processor_run',
      entityId: 'workspace-instructions-processor',
      startedAt: '2026-01-01T10:00:03Z',
    }),
    span({ spanId: 'p4', spanType: 'processor_run', entityId: 'skills-processor', startedAt: '2026-01-01T10:00:04Z' }),
    span({ spanId: 'p5', spanType: 'processor_run', entityId: 'moderation', startedAt: '2026-01-01T10:00:05Z' }),
  ];

  it('hides infrastructure processors but keeps business ones', () => {
    expect(buildThreadTimeline(infra).entries.map(e => e.spanId)).toEqual(['p5']);
  });

  it('falls back to AgentRunAttributes.prompt when agent_run carries no input', () => {
    const spans = [span({ spanId: 'root', spanType: 'agent_run', attributes: { prompt: 'How do I braise?' } })];
    expect(buildThreadTimeline(spans).userTurn).toBe('How do I braise?');
  });

  it('reads a message-shaped AgentRunAttributes.prompt', () => {
    const spans = [
      span({ spanId: 'root', spanType: 'agent_run', attributes: { prompt: [{ role: 'user', content: 'Braise?' }] } }),
    ];
    expect(buildThreadTimeline(spans).userTurn).toBe('Braise?');
  });

  it('prefers agent_run.input over attributes.prompt', () => {
    const spans = [
      span({ spanId: 'root', spanType: 'agent_run', input: 'from input', attributes: { prompt: 'from prompt' } }),
    ];
    expect(buildThreadTimeline(spans).userTurn).toBe('from input');
  });

  it('falls back to the model_generation prompt when agent_run carries no input', () => {
    const spans = [
      span({ spanId: 'root', spanType: 'agent_run', startedAt: '2026-01-01T10:00:00Z' }),
      span({
        spanId: 'gen',
        spanType: 'model_generation',
        parentSpanId: 'root',
        startedAt: '2026-01-01T10:00:01Z',
        // Shape opened by the in-process loop: `llm/model/model.loop.ts:176`.
        input: {
          messages: [
            { role: 'system', content: 'you are a chef' },
            { role: 'user', content: [{ type: 'text', text: 'What can I cook?' }] },
          ],
        },
      }),
    ];
    expect(buildThreadTimeline(spans).userTurn).toBe('What can I cook?');
  });

  it('falls back to the agent_run inputPreview', () => {
    const spans = [span({ spanId: 'root', spanType: 'agent_run', inputPreview: 'Hello there' })];
    expect(buildThreadTimeline(spans).userTurn).toBe('Hello there');
  });

  it('falls back to a non-root agent_run for the user turn', () => {
    const nested = [span({ spanId: 'a', spanType: 'agent_run', parentSpanId: 'x', input: 'Coucou' })];
    expect(buildThreadTimeline(nested).userTurn).toBe('Coucou');
  });

  it('hides a processor whose identifier only differs by casing and separators', () => {
    const spans = [
      span({
        spanId: 'p',
        spanType: 'processor_run',
        name: 'output stream processor: ObservationalMemoryProcessor',
      }),
    ];
    expect(buildThreadTimeline(spans).entries).toEqual([]);
  });

  it('hides the descendants of a hidden processor', () => {
    const spans = [
      span({ spanId: 'root', spanType: 'agent_run', input: 'hi', startedAt: '2026-01-01T10:00:00Z' }),
      span({
        spanId: 'om',
        spanType: 'processor_run',
        entityId: 'observational-memory',
        parentSpanId: 'root',
        startedAt: '2026-01-01T10:00:01Z',
      }),
      span({ spanId: 'om-gen', spanType: 'model_generation', parentSpanId: 'om', startedAt: '2026-01-01T10:00:02Z' }),
      span({ spanId: 'om-tool', spanType: 'tool_call', parentSpanId: 'om-gen', startedAt: '2026-01-01T10:00:03Z' }),
      span({ spanId: 'gen', spanType: 'model_generation', parentSpanId: 'root', startedAt: '2026-01-01T10:00:04Z' }),
    ];

    expect(buildThreadTimeline(spans).entries.map(e => e.spanId)).toEqual(['gen']);
  });

  it('hides descendants nested under an agent_run of a hidden processor, whatever the span order', () => {
    const spans = [
      // The observer's model call is listed before the agent_run that owns it.
      span({
        spanId: 'om-gen',
        spanType: 'model_generation',
        parentSpanId: 'om-agent',
        startedAt: '2026-01-01T10:00:03Z',
      }),
      span({ spanId: 'om-agent', spanType: 'agent_run', parentSpanId: 'om', startedAt: '2026-01-01T10:00:02Z' }),
      span({
        spanId: 'om',
        spanType: 'processor_run',
        entityId: 'observational-memory',
        startedAt: '2026-01-01T10:00:01Z',
      }),
      span({ spanId: 'gen', spanType: 'model_generation', startedAt: '2026-01-01T10:00:04Z' }),
    ];

    expect(buildThreadTimeline(spans).entries.map(e => e.spanId)).toEqual(['gen']);
  });

  it('keeps the descendants of a business processor', () => {
    const spans = [
      span({ spanId: 'mod', spanType: 'processor_run', entityId: 'moderation', startedAt: '2026-01-01T10:00:01Z' }),
      span({ spanId: 'gen', spanType: 'model_generation', parentSpanId: 'mod', startedAt: '2026-01-01T10:00:02Z' }),
    ];

    expect(buildThreadTimeline(spans).entries.map(e => e.spanId)).toEqual(['mod', 'gen']);
  });
});

describe('turn origin and answer', () => {
  it('uses the root agent_run as the 0s origin and closes on its output', () => {
    const timeline = buildThreadTimeline([
      span({
        spanId: 'root',
        spanType: 'agent_run',
        input: 'hi',
        output: { text: 'Hello there' },
        startedAt: '2026-01-01T10:00:00.000Z',
        endedAt: '2026-01-01T10:00:07.700Z',
      }),
    ]);

    expect(timeline.turnStart).toBe(Date.parse('2026-01-01T10:00:00.000Z'));
    expect(timeline.answerAt).toBe(Date.parse('2026-01-01T10:00:07.700Z'));
    expect(timeline.answer).toBe('Hello there');
  });

  it('falls back to the last model generation for the answer', () => {
    const timeline = buildThreadTimeline([
      span({ spanId: 'root', spanType: 'agent_run', input: 'hi', startedAt: '2026-01-01T10:00:00.000Z' }),
      span({
        spanId: 'gen-1',
        spanType: 'model_generation',
        output: { text: 'first' },
        startedAt: '2026-01-01T10:00:01.000Z',
      }),
      span({
        spanId: 'gen-2',
        spanType: 'model_generation',
        output: { text: 'final' },
        startedAt: '2026-01-01T10:00:02.000Z',
        endedAt: '2026-01-01T10:00:03.000Z',
      }),
    ]);

    expect(timeline.answer).toBe('final');
    expect(timeline.answerAt).toBe(Date.parse('2026-01-01T10:00:03.000Z'));
  });

  it('ignores an observational-memory model generation when picking the answer', () => {
    const timeline = buildThreadTimeline([
      span({ spanId: 'root', spanType: 'agent_run', input: 'hi', startedAt: '2026-01-01T10:00:00.000Z' }),
      span({
        spanId: 'gen',
        spanType: 'model_generation',
        parentSpanId: 'root',
        output: { text: 'Here is your recipe' },
        startedAt: '2026-01-01T10:00:01.000Z',
        endedAt: '2026-01-01T10:00:02.000Z',
      }),
      span({
        spanId: 'om',
        spanType: 'processor_run',
        entityId: 'observational-memory',
        parentSpanId: 'root',
        startedAt: '2026-01-01T10:00:03.000Z',
      }),
      span({
        spanId: 'om-gen',
        spanType: 'model_generation',
        parentSpanId: 'om',
        output: { text: '<observations>…</observations>' },
        startedAt: '2026-01-01T10:00:04.000Z',
        endedAt: '2026-01-01T10:00:05.000Z',
      }),
    ]);

    expect(timeline.answer).toBe('Here is your recipe');
    expect(timeline.answerAt).toBe(Date.parse('2026-01-01T10:00:02.000Z'));
    expect(timeline.entries.map(e => e.spanId)).toEqual(['gen']);
  });

  it('reads an assistant message-shaped output', () => {
    const timeline = buildThreadTimeline([
      span({
        spanId: 'root',
        spanType: 'agent_run',
        output: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: [{ type: 'text', text: 'Bonjour' }] },
        ],
      }),
    ]);

    expect(timeline.answer).toBe('Bonjour');
  });

  it('leaves the answer undefined when the output carries no text', () => {
    const timeline = buildThreadTimeline([span({ spanId: 'root', spanType: 'agent_run', output: { usage: {} } })]);
    expect(timeline.answer).toBeUndefined();
  });
});
