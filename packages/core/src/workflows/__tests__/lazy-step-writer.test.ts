import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { ToolStream } from '../../tools/stream';
import { createWorkflow } from '../create';
import { createStep } from '../workflow';

const constructions = vi.hoisted(() => ({ count: 0 }));

vi.mock('../../tools/stream', async importOriginal => {
  const actual = await importOriginal<typeof import('../../tools/stream')>();
  class CountedToolStream extends actual.ToolStream {
    constructor(...args: ConstructorParameters<typeof actual.ToolStream>) {
      super(...args);
      constructions.count++;
    }
  }
  return { ...actual, ToolStream: CountedToolStream };
});

const schema = z.object({ value: z.number() });

function register(workflow: ReturnType<typeof createWorkflow>) {
  new Mastra({ logger: false, storage: new MockStore(), workflows: { [workflow.id]: workflow } });
}

describe('lazy workflow step writer', () => {
  beforeEach(() => {
    constructions.count = 0;
  });

  it('does not construct a ToolStream for steps that never read writer', async () => {
    const step = createStep({
      id: 'increment',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
    });
    const workflow = createWorkflow({ id: 'lazy-unused', inputSchema: schema, outputSchema: schema })
      .then(step)
      .then(step)
      .commit();
    register(workflow);

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: 1 } });

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ value: 3 });
    expect(constructions.count).toBe(0);
  });

  it('constructs the writer once on first access and still emits write and custom chunks', async () => {
    const seen: { sameInstance?: boolean; isToolStream?: boolean } = {};
    const step = createStep({
      id: 'writing-step',
      inputSchema: schema,
      outputSchema: schema,
      execute: async context => {
        const first = context.writer;
        seen.sameInstance = first === context.writer;
        seen.isToolStream = first instanceof ToolStream;
        await first.write({ message: 'WRITE' });
        await first.custom({ type: 'custom-status', data: { message: 'CUSTOM' } });
        return context.inputData;
      },
    });
    const workflow = createWorkflow({ id: 'lazy-used', inputSchema: schema, outputSchema: schema }).then(step).commit();
    register(workflow);

    const run = await workflow.createRun();
    const events: any[] = [];
    for await (const event of run.stream({ inputData: { value: 1 } }).fullStream) {
      events.push(event);
    }

    expect(seen).toEqual({ sameInstance: true, isToolStream: true });
    expect(constructions.count).toBe(1);
    expect(events.find(e => e.type === 'workflow-step-output' && e.payload?.output?.message === 'WRITE')).toMatchObject(
      { payload: { stepName: 'writing-step' } },
    );
    expect(events.find(e => e.type === 'custom-status' && e.data?.message === 'CUSTOM')).toBeDefined();
  });

  it('keeps writer available through destructuring and object spread', async () => {
    const seen: { destructured?: boolean; spread?: boolean } = {};
    const step = createStep({
      id: 'spread-step',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ writer, ...rest }) => {
        seen.destructured = writer instanceof ToolStream;
        const copy = { ...rest, writer };
        seen.spread = copy.writer === writer;
        return rest.inputData;
      },
    });
    const workflow = createWorkflow({ id: 'lazy-spread', inputSchema: schema, outputSchema: schema })
      .then(step)
      .commit();
    register(workflow);

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: 1 } });

    expect(result.status).toBe('success');
    expect(seen).toEqual({ destructured: true, spread: true });
    expect(constructions.count).toBe(1);
  });

  it('does not construct writers for loop conditions, branch conditions, or dynamic sleeps that ignore them', async () => {
    const step = createStep({
      id: 'loop-increment',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
    });
    const branchStep = createStep({
      id: 'branch-step',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow({ id: 'lazy-control-flow', inputSchema: schema, outputSchema: schema })
      .dowhile(step, async ({ inputData }) => inputData.value < 5)
      .sleep(async () => 0)
      .sleepUntil(async () => new Date())
      .branch([[async ({ inputData }) => inputData.value === 5, branchStep]])
      .commit();
    register(workflow);

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: 1 } });

    expect(result.status).toBe('success');
    expect(constructions.count).toBe(0);
  });

  it('still lets loop conditions emit custom chunks through writer', async () => {
    const step = createStep({
      id: 'loop-increment',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => ({ value: inputData.value + 1 }),
    });
    const workflow = createWorkflow({ id: 'lazy-condition-writer', inputSchema: schema, outputSchema: schema })
      .dowhile(step, async ({ inputData, writer }) => {
        await writer.custom({ type: 'condition-status', data: { value: inputData.value } });
        return inputData.value < 3;
      })
      .commit();
    register(workflow);

    const run = await workflow.createRun();
    const events: any[] = [];
    for await (const event of run.stream({ inputData: { value: 1 } }).fullStream) {
      events.push(event);
    }

    expect(events.filter(e => e.type === 'condition-status').map(e => e.data.value)).toEqual([2, 3]);
    expect(constructions.count).toBe(2);
  });
});
