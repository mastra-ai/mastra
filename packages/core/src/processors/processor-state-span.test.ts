/**
 * `ProcessorState` builds the span for `processOutputStream` in its
 * constructor rather than at one of the runner's call sites, so it is the one
 * place a processor's span declaration could be dropped while every other
 * phase honours it. These drive the constructor directly: the path is reached
 * from `ProcessorRunner.processPart` (durable tool calls, the loop's stream
 * steps, structured output), not from a plain agent run, so an agent-level
 * test passes whether or not the declaration is wired.
 */
import { describe, expect, it } from 'vitest';
import { EntityType, SpanType } from '../observability';
import type { Span } from '../observability';
import { ProcessorState } from './runner';
import type { Processor } from './index';

/** Minimal span stand-in that records what `createChildSpan` was asked for. */
function createParentSpan() {
  const created: any[] = [];
  const span = {
    createChildSpan: (options: any) => {
      created.push(options);
      return { ...options, end: () => {}, error: () => {} };
    },
    findParent: () => undefined,
    parent: undefined,
  };
  return { span: span as unknown as Span<SpanType.AGENT_RUN>, created };
}

function buildState(processor?: Pick<Processor, 'id' | 'spanType' | 'spanName' | 'spanAttributes'>) {
  const { span, created } = createParentSpan();
  new ProcessorState({
    processorName: 'Streaming Processor',
    processorIndex: 3,
    createSpan: true,
    tracingContext: { currentSpan: span },
    ...(processor ? { processor } : {}),
  });
  return created;
}

describe('ProcessorState span creation', () => {
  it('uses the processor’s declared type, name and attributes', () => {
    const created = buildState({
      id: 'streaming',
      spanType: SpanType.MEMORY_OPERATION,
      spanName: 'memory: stream',
      spanAttributes: { operationType: 'recall' },
    });

    expect(created).toHaveLength(1);
    const options = created[0];

    expect(options.type).toBe(SpanType.MEMORY_OPERATION);
    expect(options.name).toBe('memory: stream');
    expect(options.attributes.operationType).toBe('recall');
    expect(options.entityId).toBe('streaming');
    // Retyping never costs the span its pipeline facts.
    expect(options.entityType).toBe(EntityType.OUTPUT_PROCESSOR);
    expect(options.attributes.processorExecutor).toBe('legacy');
    expect(options.attributes.processorIndex).toBe(3);
  });

  it('resolves a phase-dependent name against the output phase', () => {
    const created = buildState({
      id: 'streaming',
      spanType: SpanType.MEMORY_OPERATION,
      spanName: phase => `phase:${phase}`,
      spanAttributes: phase => ({ operationType: phase === 'output' ? 'save' : 'recall' }),
    });

    expect(created[0].name).toBe('phase:output');
    expect(created[0].attributes.operationType).toBe('save');
  });

  it('cannot let a declaration overwrite the runner-owned pipeline facts', () => {
    const created = buildState({
      id: 'streaming',
      spanType: SpanType.MEMORY_OPERATION,
      spanName: 'memory: stream',
      spanAttributes: { operationType: 'recall', processorExecutor: 'workflow', processorIndex: 99 },
    });

    expect(created[0].attributes.processorExecutor).toBe('legacy');
    expect(created[0].attributes.processorIndex).toBe(3);
  });

  it('falls back to the default label when nothing is declared', () => {
    const created = buildState();

    expect(created[0].type).toBe(SpanType.PROCESSOR_RUN);
    expect(created[0].name).toBe('output stream processor: Streaming Processor');
  });
});
