import { mkdtemp, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { writeHeapSnapshot } from 'node:v8';
import { convertArrayToReadableStream, MockLanguageModelV3 } from '@internal/ai-v6/test';
import { expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { LocalFilesystem } from '../../workspace/filesystem';
import { Workspace } from '../../workspace/workspace';
import { Agent } from '../agent';

const samplingOptions = {
  samplingInterval: 32768,
  // Node's declarations omit these supported V8 protocol options.
  includeObjectsCollectedByMajorGC: true,
  includeObjectsCollectedByMinorGC: true,
};

it.skipIf(process.env.MASTRA_WORKSPACE_LOAD_PROFILE !== 'true')(
  'profiles 50 concurrent sessions for 101 turns',
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-disabled-tools-'));
    const inspector = new Session();
    inspector.connect();
    const delay = monitorEventLoopDelay({ resolution: 20 });
    delay.enable();
    const samples: { elapsedMs: number; cpu: NodeJS.CpuUsage; memory: NodeJS.MemoryUsage }[] = [];
    const started = performance.now();
    const initialCpu = process.cpuUsage();
    const timer = setInterval(() => {
      samples.push({
        elapsedMs: performance.now() - started,
        cpu: process.cpuUsage(initialCpu),
        memory: process.memoryUsage(),
      });
    }, 250);
    let arrivals = 0;
    let completed = 0;
    let barrier = Promise.withResolvers<void>();
    const sessions = Array.from({ length: 50 }, (_, index) => {
      const threadId = `session-${index}`;
      const model = new MockLanguageModelV3({
        doStream: async () => {
          model.doStreamCalls.length = 0;
          arrivals++;
          if (arrivals === 50) barrier.resolve();
          await barrier.promise;
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'response' },
              { type: 'text-delta', id: 'response', delta: threadId },
              { type: 'text-end', id: 'response' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'STOP' },
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                  outputTokens: { total: 5, text: 5, reasoning: undefined },
                },
              },
            ]),
          };
        },
      });
      return {
        threadId,
        agent: new Agent({
          id: threadId,
          name: threadId,
          instructions: 'Reply with your session identifier.',
          model,
          memory: new MockMemory(),
          workspace: new Workspace({
            filesystem: new LocalFilesystem({ basePath: directory }),
            tools: { enabled: false },
          }),
        }),
      };
    });
    const snapshot = async (label: string) => {
      writeHeapSnapshot(join(directory, `${label}.heapsnapshot`));
      const { profile } = await inspector.post('HeapProfiler.getSamplingProfile');
      await writeFile(join(directory, `${label}.heapprofile`), JSON.stringify(profile));
    };
    try {
      await inspector.post('HeapProfiler.enable');
      await inspector.post('HeapProfiler.startSampling', samplingOptions);
      await inspector.post('Profiler.enable');
      await inspector.post('Profiler.start');
      await snapshot('sessions-loaded');
      for (let turn = 1; turn <= 101; turn++) {
        arrivals = 0;
        barrier = Promise.withResolvers<void>();
        await Promise.all(
          sessions.map(async ({ agent, threadId }) => {
            const result = await agent.stream(`Turn ${turn}`, { memory: { thread: threadId, resource: threadId } });
            expect(await result.text).toBe(threadId);
            completed++;
          }),
        );
        expect(arrivals).toBe(50);
        if (turn % 20 === 0 || turn === 101) await snapshot(`turn-${turn}`);
      }
      expect(completed).toBe(5050);
      sessions.length = 0;
      await new Promise<void>(resolve => setTimeout(resolve, 250));
      await snapshot('after-cleanup');
      const { profile: allocations } = await inspector.post('HeapProfiler.stopSampling');
      const { profile: cpu } = await inspector.post('Profiler.stop');
      await writeFile(join(directory, 'allocations.heapprofile'), JSON.stringify(allocations));
      await writeFile(join(directory, 'cpu.cpuprofile'), JSON.stringify(cpu));
      await writeFile(
        join(directory, 'resources.json'),
        JSON.stringify({
          completed,
          samples,
          elapsedMs: performance.now() - started,
          cpu: process.cpuUsage(initialCpu),
          memory: process.memoryUsage(),
          eventLoopDelay: { mean: delay.mean, max: delay.max, p99: delay.percentile(99) },
        }),
      );
      process.stdout.write(`Workspace load profile: ${directory}\n`);
    } finally {
      clearInterval(timer);
      delay.disable();
      inspector.disconnect();
    }
  },
  600000,
);
