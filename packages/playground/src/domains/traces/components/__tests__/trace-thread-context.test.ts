import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';

import { getTraceThreadId } from '../trace-thread-context';
import { panelTraceSpans } from './fixtures/trace-span-panel';

const agentRoot = panelTraceSpans.spans.find(span => span.parentSpanId == null)!;

describe('getTraceThreadId', () => {
  it('given an agent root span with a thread id, then returns the thread id', () => {
    expect(agentRoot.spanType).toBe(SpanType.AGENT_RUN);
    expect(getTraceThreadId(agentRoot)).toBe(agentRoot.threadId);
  });

  it('given a branch anchor, then returns undefined', () => {
    expect(getTraceThreadId(agentRoot, agentRoot.spanId)).toBeUndefined();
  });

  it('given a null thread id, then returns undefined', () => {
    expect(getTraceThreadId({ ...agentRoot, threadId: null })).toBeUndefined();
  });

  it('given a workflow root, then returns undefined', () => {
    expect(getTraceThreadId({ ...agentRoot, spanType: SpanType.WORKFLOW_RUN })).toBeUndefined();
  });

  it('given no root span, then returns undefined', () => {
    expect(getTraceThreadId(undefined)).toBeUndefined();
  });
});
