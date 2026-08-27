import { describe, expect, it } from 'vitest';

import { buildThreadTimeline, extractUserTurn, type TimelineSpan } from '../build-thread-timeline';

const span = (partial: Partial<TimelineSpan> & { spanId: string }): TimelineSpan => partial;

/** Span ids in display order: a parent immediately followed by its subtree. */
const ids = (nodes: ReturnType<typeof buildThreadTimeline>['entries']): string[] =>
  nodes.flatMap(node => [node.span.spanId, ...ids(node.children)]);

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
      output: 'Salut !',
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

  it('keeps the conversation spans, in chronological order', () => {
    // `chunk` and `step` are streaming mechanics, not moments of the conversation.
    expect(ids(buildThreadTimeline(spans).entries)).toEqual(['gen', 'tool']);
  });

  it('nests spans under their parent rather than flattening the trace', () => {
    const nested = [
      span({ spanId: 'root', spanType: 'agent_run', startedAt: '2026-01-01T10:00:00Z' }),
      span({ spanId: 'gen', spanType: 'model_generation', parentSpanId: 'root', startedAt: '2026-01-01T10:00:01Z' }),
      span({ spanId: 'tool', spanType: 'tool_call', parentSpanId: 'gen', startedAt: '2026-01-01T10:00:02Z' }),
    ];
    const { entries } = buildThreadTimeline(nested);

    // `agent_run` carries no row, so its children stand at the top level; `tool` stays under `gen`.
    expect(entries.map(node => node.span.spanId)).toEqual(['gen']);
    expect(entries[0]?.children.map(node => node.span.spanId)).toEqual(['tool']);
  });

  it('promotes the children of a span it does not render', () => {
    // A tool call reached through a `model_step` still belongs to the conversation: dropping the
    // step must not take the call down with it.
    const throughStep = [
      span({ spanId: 'gen', spanType: 'model_generation', startedAt: '2026-01-01T10:00:01Z' }),
      span({ spanId: 'step', spanType: 'model_step', parentSpanId: 'gen', startedAt: '2026-01-01T10:00:02Z' }),
      span({ spanId: 'tool', spanType: 'tool_call', parentSpanId: 'step', startedAt: '2026-01-01T10:00:03Z' }),
    ];
    const { entries } = buildThreadTimeline(throughStep);

    expect(ids(entries)).toEqual(['gen', 'tool']);
    expect(entries[0]?.children.map(node => node.span.spanId)).toEqual(['tool']);
  });

  it('anchors the answer on the root agent_run, which is no longer a row of its own', () => {
    expect(buildThreadTimeline(spans).answerSpanId).toBe('root');
  });

  it('leaves the answer unanchored when it falls back to a model_generation', () => {
    const withoutRoot = [span({ spanId: 'gen', spanType: 'model_generation', output: 'Une ratatouille' })];
    const timeline = buildThreadTimeline(withoutRoot);
    expect(timeline.answer).toBe('Une ratatouille');
    expect(timeline.answerSpanId).toBeUndefined();
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

  it('hides the plumbing processors and keeps the applicative ones', () => {
    expect(ids(buildThreadTimeline(infra).entries)).toEqual(['p5']);
  });

  it('matches a processor however its id or name is spelled', () => {
    const spelled = [
      span({ spanId: 'a', spanType: 'processor_run', name: 'input processor: ObservationalMemoryProcessor' }),
      span({ spanId: 'b', spanType: 'processor_run', entityId: 'Task State' }),
    ];
    expect(buildThreadTimeline(spelled).entries).toEqual([]);
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

  it('keeps the descendants of an applicative processor', () => {
    const spans = [
      span({ spanId: 'mod', spanType: 'processor_run', entityId: 'moderation', startedAt: '2026-01-01T10:00:01Z' }),
      span({ spanId: 'gen', spanType: 'model_generation', parentSpanId: 'mod', startedAt: '2026-01-01T10:00:02Z' }),
    ];

    expect(ids(buildThreadTimeline(spans).entries)).toEqual(['mod', 'gen']);
  });

  it('takes the whole subtree of a plumbing processor down with it', () => {
    // The observer agent runs its own model generations. They are not part of the conversation.
    const spans = [
      span({ spanId: 'om', spanType: 'processor_run', entityId: 'observational-memory' }),
      span({ spanId: 'om-gen', spanType: 'model_generation', parentSpanId: 'om' }),
      span({ spanId: 'om-tool', spanType: 'tool_call', parentSpanId: 'om-gen' }),
    ];

    expect(buildThreadTimeline(spans).entries).toEqual([]);
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

  it('closes on the conversation, not on what the observer wrote afterwards', () => {
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
    expect(ids(timeline.entries)).toEqual(['gen']);
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
