import { describe, expect, it } from 'vitest';
import { compactDurableStepContent, durableStopConditionSteps } from './index';

// A durable step record as the loop stores it: Mastra tool-call payloads in
// `toolResults`, and content whose tool-result outputs were compacted away.
function weatherStepRecord() {
  const toolResults = [
    {
      toolCallId: 'call_weather',
      toolName: 'weather',
      args: { location: 'Toronto' },
      result: { temperature: 70, conditions: 'sunny' },
    },
  ];
  const content = compactDurableStepContent(
    [
      { type: 'tool-call', toolCallId: 'call_weather', toolName: 'weather', input: { location: 'Toronto' } },
      {
        type: 'tool-result',
        toolCallId: 'call_weather',
        toolName: 'weather',
        output: { type: 'json', value: { temperature: 70, conditions: 'sunny' } },
      },
    ],
    toolResults,
  );
  return { text: '', content, toolCalls: [], toolResults };
}

describe('durableStopConditionSteps (#28519)', () => {
  it('gives stopWhen the AI SDK tool-result parts, with compacted outputs restored', () => {
    const [step] = durableStopConditionSteps([weatherStepRecord()]);

    expect(step?.toolResults).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'call_weather',
        toolName: 'weather',
        output: { type: 'json', value: { temperature: 70, conditions: 'sunny' } },
      },
    ]);
  });

  it('splits tool results into static and dynamic views by their dynamic flag', () => {
    const part = (toolCallId: string, dynamic?: boolean) => ({
      type: 'tool-result',
      toolCallId,
      toolName: toolCallId,
      output: { type: 'json', value: null },
      ...(dynamic === undefined ? {} : { dynamic }),
    });
    const content = [part('static_tool', false), part('dynamic_tool', true), part('unflagged_tool')];

    const [step] = durableStopConditionSteps([{ content, toolResults: [] }]);

    const ids = (parts: unknown) => (parts as Array<{ toolCallId: string }>).map(p => p.toolCallId);
    expect(ids(step?.toolResults)).toEqual(['static_tool', 'dynamic_tool', 'unflagged_tool']);
    expect(ids((step as { staticToolResults: unknown }).staticToolResults)).toEqual(['static_tool']);
    expect(ids((step as { dynamicToolResults: unknown }).dynamicToolResults)).toEqual(['dynamic_tool']);
  });

  // Snapshot compaction matches content to the records' chunk-shaped toolResults,
  // so the view handed to stopWhen must not leak back into the stored state.
  it('leaves the stored step records unchanged', () => {
    const record = weatherStepRecord();
    const stored = structuredClone(record);

    durableStopConditionSteps([record]);

    expect(record).toEqual(stored);
  });

  // A run snapshotted before step records carried content has nothing to read
  // parts from, so stopWhen keeps getting the stored results rather than none.
  it('keeps the stored tool results for records written before steps carried content', () => {
    const { content: _content, ...legacy } = weatherStepRecord();

    const [step] = durableStopConditionSteps([legacy]);

    expect(step?.toolResults).toBe(legacy.toolResults);
  });
});
