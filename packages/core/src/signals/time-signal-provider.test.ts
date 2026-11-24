import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../agent';
import { mastraDBMessageToSignal } from '../agent/signals';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import type { ComputeStateSignalArgs } from '../processors';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';

import type { TimeStateProcessor } from './time-signal-provider';
import { TimeSignalProvider } from './index';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function processorOf(provider: TimeSignalProvider): TimeStateProcessor {
  return provider.getInputProcessors()[0] as TimeStateProcessor;
}

/** Minimal hook args: only the fields the time lane reads. */
function args(
  overrides: { hasSnapshot?: boolean; cacheKey?: string; updatedAt?: string } = {},
): ComputeStateSignalArgs {
  return {
    threadId: 'thread-1',
    resourceId: 'resource-1',
    contextWindow: { hasSnapshot: overrides.hasSnapshot ?? false },
    tracking:
      overrides.cacheKey || overrides.updatedAt
        ? { currentCacheKey: overrides.cacheKey, currentMode: 'snapshot', updatedAt: overrides.updatedAt }
        : undefined,
    activeStateSignals: [],
    deltasSinceSnapshot: [],
  } as unknown as ComputeStateSignalArgs;
}

/** Run the hook the way the runner does: feed the last emitted key back as tracking. */
function lane(provider: TimeSignalProvider) {
  const processor = processorOf(provider);
  let cacheKey: string | undefined;
  let updatedAt: string | undefined;
  return {
    async step() {
      const result = await processor.computeStateSignal(args({ hasSnapshot: Boolean(cacheKey), cacheKey, updatedAt }));
      if (result) {
        cacheKey = result.cacheKey;
        updatedAt = new Date().toISOString();
      }
      return result;
    },
    dropWindow() {
      // The lane's snapshot left the context window; tracking stays on thread metadata.
      return processor.computeStateSignal(args({ hasSnapshot: false, cacheKey, updatedAt }));
    },
  };
}

describe('TimeSignalProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('has a stable id and one stable time-lane processor', () => {
    const provider = new TimeSignalProvider();
    expect(provider.id).toBe('time-signals');
    const processors = provider.getInputProcessors();
    expect(processors).toHaveLength(1);
    expect(provider.getInputProcessors()[0]).toBe(processors[0]);
    // Tracking is read under stateId; it must equal the emitted lane id.
    expect(processorOf(provider).stateId).toBe('current-time');
  });

  it('emits a current-time snapshot on the first step', async () => {
    vi.setSystemTime(new Date('2026-11-24T08:15:30Z'));
    const result = await lane(new TimeSignalProvider({ timeZone: 'America/Los_Angeles' })).step();
    expect(result).toMatchObject({
      id: 'current-time',
      tagName: 'current-time',
      mode: 'snapshot',
      cacheKey: 'time:2026-11-24T00:15-08:00',
      contents: 'Tuesday, November 24, 2026 at 12:15 AM PST',
      attributes: { timeZone: 'America/Los_Angeles' },
      value: { iso: '2026-11-24T08:15:30.000Z', timeZone: 'America/Los_Angeles', interval: MINUTE },
    });
  });

  it('emits nothing within the same minute and a new snapshot after the boundary', async () => {
    vi.setSystemTime(new Date('2026-11-24T08:15:05Z'));
    const time = lane(new TimeSignalProvider({ timeZone: 'UTC' }));
    expect(await time.step()).toBeDefined();
    vi.setSystemTime(new Date('2026-11-24T08:15:59Z'));
    expect(await time.step()).toBeUndefined();
    vi.setSystemTime(new Date('2026-11-24T08:16:00Z'));
    expect((await time.step())?.contents).toBe('Tuesday, November 24, 2026 at 8:16 AM UTC');
  });

  it('re-emits when the snapshot has left the context window', async () => {
    vi.setSystemTime(new Date('2026-11-24T08:15:05Z'));
    const time = lane(new TimeSignalProvider({ timeZone: 'UTC' }));
    await time.step();
    expect(await time.dropWindow()).toBeDefined();
  });

  it('aligns 15-minute buckets to local wall-clock boundaries in a +5:30 zone', async () => {
    const time = lane(new TimeSignalProvider({ interval: 15 * MINUTE, timeZone: 'Asia/Kolkata' }));
    // 08:14Z is 13:44 IST, bucket 13:30-13:45 local.
    vi.setSystemTime(new Date('2026-11-24T08:14:00Z'));
    expect(await time.step()).toBeDefined();
    vi.setSystemTime(new Date('2026-11-24T08:14:59Z'));
    expect(await time.step()).toBeUndefined();
    // 08:15Z is 13:45 IST: a new local bucket, though 08:15Z is not a UTC quarter-hour of the same bucket.
    vi.setSystemTime(new Date('2026-11-24T08:15:00Z'));
    expect((await time.step())?.contents).toBe('Tuesday, November 24, 2026 at 1:45 PM GMT+5:30');
  });

  it('formats to the width of the interval', async () => {
    vi.setSystemTime(new Date('2026-11-24T08:59:30Z'));
    const hourly = await lane(new TimeSignalProvider({ interval: 'hour', timeZone: 'America/Los_Angeles' })).step();
    expect(hourly?.contents).toBe('Tuesday, November 24, 2026 at 12 AM PST');
    const daily = await lane(new TimeSignalProvider({ interval: 'day', timeZone: 'America/Los_Angeles' })).step();
    expect(daily?.contents).toBe('Tuesday, November 24, 2026 (PST)');
  });

  it('accepts Intl options and a format function as overrides', async () => {
    vi.setSystemTime(new Date('2026-11-24T08:15:30Z'));
    const intl = await lane(
      new TimeSignalProvider({ timeZone: 'UTC', locale: 'en-GB', format: { dateStyle: 'short', timeStyle: 'short' } }),
    ).step();
    expect(intl?.contents).toBe('24/11/2026, 08:15');
    const fn = vi.fn(
      (date: Date, options: { timeZone: string; locale: string }) => `${date.toISOString()} ${options.timeZone}`,
    );
    const custom = await lane(new TimeSignalProvider({ timeZone: 'UTC', format: fn })).step();
    expect(custom?.contents).toBe('2026-11-24T08:15:30.000Z UTC');
    expect(fn).toHaveBeenCalledWith(expect.any(Date), { timeZone: 'UTC', locale: 'en-US' });
  });

  it('gives each pass of the repeated hour at DST fall-back its own snapshot', async () => {
    const time = lane(new TimeSignalProvider({ interval: 'hour', timeZone: 'America/Los_Angeles' }));
    // 2026-11-01: 01:30 PDT (08:30Z), then the clocks go back and 01:30 PST (09:30Z).
    vi.setSystemTime(new Date('2026-11-01T08:30:00Z'));
    expect((await time.step())?.contents).toBe('Sunday, November 1, 2026 at 1 AM PDT');
    vi.setSystemTime(new Date('2026-11-01T09:30:00Z'));
    expect((await time.step())?.contents).toBe('Sunday, November 1, 2026 at 1 AM PST');
  });

  it('keeps one day bucket across spring-forward', async () => {
    const time = lane(new TimeSignalProvider({ interval: 'day', timeZone: 'America/Los_Angeles' }));
    // 2026-03-08: 01:30 PST (09:30Z), then 03:30 PDT (10:30Z) after the skipped hour.
    vi.setSystemTime(new Date('2026-03-08T09:30:00Z'));
    expect(await time.step()).toBeDefined();
    vi.setSystemTime(new Date('2026-03-08T10:30:00Z'));
    expect(await time.step()).toBeUndefined();
    // Next local day.
    vi.setSystemTime(new Date('2026-03-09T07:00:00Z'));
    expect((await time.step())?.cacheKey).toBe('time:2026-03-09');
  });

  it('with align: false, measures the interval from the last snapshot, across window loss', async () => {
    const time = lane(new TimeSignalProvider({ interval: 10 * MINUTE, align: false, timeZone: 'UTC' }));
    vi.setSystemTime(new Date('2026-11-24T08:07:00Z'));
    expect(await time.step()).toBeDefined();
    // 08:10 is a wall-clock boundary, but only 3 minutes have passed.
    vi.setSystemTime(new Date('2026-11-24T08:10:00Z'));
    expect(await time.step()).toBeUndefined();
    vi.setSystemTime(new Date('2026-11-24T08:17:00Z'));
    expect((await time.step())?.contents).toBe('Tuesday, November 24, 2026 at 8:17 AM UTC');
    vi.setSystemTime(new Date('2026-11-24T08:18:00Z'));
    expect(await time.dropWindow()).toBeDefined();
  });

  it('rejects intervals and time zones it cannot honour', () => {
    expect(() => new TimeSignalProvider({ interval: 0 })).toThrow(/interval/);
    expect(() => new TimeSignalProvider({ interval: 90_000 })).toThrow(/whole minutes/);
    expect(() => new TimeSignalProvider({ interval: 7 * MINUTE })).toThrow(/divide/);
    expect(() => new TimeSignalProvider({ interval: 2 * 24 * HOUR })).toThrow(/divide/);
    expect(() => new TimeSignalProvider({ interval: 90_000, align: false })).not.toThrow();
    expect(() => new TimeSignalProvider({ timeZone: 'Mars/Olympus' })).toThrow(/time zone/);
  });
});

describe('TimeSignalProvider on an agent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-24T08:15:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Steps 1-3 call `wait` (moving the clock a minute), step 4 answers. Records each prompt. */
  function setup(memory: MockMemory | undefined) {
    const prompts: string[] = [];
    let call = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        call++;
        const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
        if (call <= 3) {
          return {
            content: [{ type: 'tool-call', toolCallId: `c${call}`, toolName: 'wait', input: '{}' }],
            finishReason: 'tool-calls',
            usage,
            warnings: [],
          };
        }
        return { content: [{ type: 'text', text: 'done' }], finishReason: 'stop', usage, warnings: [] };
      },
    });
    const wait = createTool({
      id: 'wait',
      description: 'wait a minute',
      inputSchema: z.object({}),
      execute: async () => {
        vi.setSystemTime(new Date(Date.now() + MINUTE));
        return 'ok';
      },
    });
    const agent = new Agent({
      id: 'clock',
      name: 'clock',
      instructions: 'You know the time.',
      model,
      tools: { wait },
      ...(memory ? { memory } : {}),
      signals: [new TimeSignalProvider({ timeZone: 'UTC' })],
    });
    new Mastra({ agents: { clock: agent }, storage: new InMemoryStore(), logger: false });
    return { agent, prompts };
  }

  async function timeRows(memory: MockMemory) {
    const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'resource-1' });
    return messages
      .filter(message => message.role === 'signal')
      .map(message => mastraDBMessageToSignal(message))
      .filter(signal => signal.tagName === 'current-time')
      .map(signal => signal.contents);
  }

  it('adds one row per minute crossed, keeps them all in the prompt, newest last', async () => {
    const memory = new MockMemory();
    const { agent, prompts } = setup(memory);
    await agent.generate('what time is it?', {
      memory: { resource: 'resource-1', thread: { id: 'thread-1' } },
      maxSteps: 5,
    });

    const expected = [
      'Tuesday, November 24, 2026 at 8:15 AM UTC',
      'Tuesday, November 24, 2026 at 8:16 AM UTC',
      'Tuesday, November 24, 2026 at 8:17 AM UTC',
      'Tuesday, November 24, 2026 at 8:18 AM UTC',
    ];
    expect(await timeRows(memory)).toEqual(expected);
    // Each step's prompt carries every time snapshot so far, oldest first.
    const last = prompts.at(-1)!;
    const positions = expected.map(text => last.indexOf(text));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(prompts[0]).toContain(expected[0]);
    expect(prompts[0]).not.toContain(expected[1]);
  });

  it('adds no row for a second run within the same minute', async () => {
    const memory = new MockMemory();
    const { agent } = setup(memory);
    const target = { memory: { resource: 'resource-1', thread: { id: 'thread-1' } }, maxSteps: 1 };
    await agent.generate('first', target);
    // The first run's `wait` tool moved the clock to 08:16; come back inside 08:15.
    vi.setSystemTime(new Date('2026-11-24T08:15:30Z'));
    await agent.generate('second', target);
    expect(await timeRows(memory)).toEqual(['Tuesday, November 24, 2026 at 8:15 AM UTC']);
  });

  it('needs memory: an agent without it fails like any state lane', async () => {
    const { agent } = setup(undefined);
    await expect(agent.generate('what time is it?', { maxSteps: 1 })).rejects.toThrow(
      'computeStateSignal requires Mastra memory',
    );
  });
});
