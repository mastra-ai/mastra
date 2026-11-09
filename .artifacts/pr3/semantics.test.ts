import { appendFileSync, writeFileSync } from 'node:fs';
import { expect, it, describe, vi } from 'vitest';
import { createSharedAgent, useLoopScenarioAimock } from '../../packages/core/src/loop/test-utils/aimock/aimock-scenario';

const file = `${import.meta.dirname}/results/semantics.jsonl`;
writeFileSync(file, '');
for (const engine of ['normal', 'durable', 'evented'] as const) describe(engine, () => {
  const getMock = useLoopScenarioAimock();
  it('captures processor and callback ownership across caller and replay', async () => {
    const events: any[] = [];
    const record = (boundary: string, data: any) => {
      const event = { at: performance.now(), engine, boundary, data };
      events.push(event); appendFileSync(file, JSON.stringify(event) + '\n');
    };
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Original response.' });
    const processor = {
      id: 'pr3-redactor',
      processOutputStream: async ({ part }: any) => {
        record('processor', { type: part.type });
        return part.type === 'text-delta' ? { ...part, payload: { ...part.payload, text: '[REDACTED]' } } : part;
      },
    };
    const { agent, mastra }: any = await createSharedAgent(llm, { engine });
    let run: any, replay: any;
    const drain = async (output: any, boundary: string) => {
      const frames: any[] = [];
      for await (const frame of output.fullStream) { frames.push(frame); record(boundary, frame); }
      return frames;
    };
    try {
      run = await agent.stream('Respond.', {
        outputProcessors: [processor],
        runId: crypto.randomUUID(),
        onStepFinish: async (data: any) => { record('caller-step-callback', { text: data.text }); },
        onFinish: async (data: any) => { record('caller-finish-callback', { text: data.text }); },
      });
      const caller = await drain(run, 'caller');
      await vi.waitFor(() => expect(events.filter(e => e.boundary === 'caller-finish-callback')).toHaveLength(1));
      const processedBeforeReplay = events.filter(e => e.boundary === 'processor').length;
      replay = await agent.observe(run.runId, {
        onFinish: async (data: any) => { record('replay-finish-callback', { text: data.text }); },
      });
      const timer = setTimeout(() => replay.detach(), 5000);
      const replayFrames = await drain(replay, 'replay').finally(() => clearTimeout(timer));
      await vi.waitFor(() => expect(events.filter(e => e.boundary === 'replay-finish-callback')).toHaveLength(1));
      const text = (frames: any[]) => frames.filter(e => e.type === 'text-delta').map(e => e.payload.text).join('');
      expect(text(caller)).toBe('[REDACTED]');
      expect(text(replayFrames)).toBe('[REDACTED]');
      expect(replayFrames.filter(e => e.type === 'finish')).toHaveLength(1);
      const replayProcessorEvents = events.filter(e => e.boundary === 'processor').slice(processedBeforeReplay).map(e => e.data.type);
      expect(replayProcessorEvents).toEqual(engine === 'normal' ? [] : ['start', 'step-finish', 'finish']);
      expect(events.filter(e => e.boundary === 'caller-finish-callback')).toHaveLength(1);
      expect(events.filter(e => e.boundary === 'caller-step-callback')).toHaveLength(1);
      record('summary', { processedBeforeReplay, callerText: text(caller), replayText: text(replayFrames) });
    } finally {
      replay?.detach?.(); run?.cleanup?.(); await mastra.shutdown();
    }
  });
});
