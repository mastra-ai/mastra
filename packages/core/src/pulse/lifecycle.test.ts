import { describe, expect, it } from 'vitest';
import { InMemoryPulseStorage } from '../storage/domains/pulse/inmemory';
import { PulseBus } from './bus';
import { registerPulseEmitter, unregisterPulseEmitter } from './emitter';
import { mintFactId } from './identity';
import { emitLifecycleFact } from './lifecycle';
import { withPulseRun } from './run-context';
import type { PulseBusEvent } from './types';

function collect(bus: PulseBus) {
  const pulses: any[] = [];
  const edges: any[] = [];
  bus.subscribe((e: PulseBusEvent) => {
    if (e.type === 'pulse') pulses.push(e.record);
    else edges.push(e.record);
  });
  return { pulses, edges };
}

const flush = () => new Promise<void>(r => setTimeout(r, 0));

describe('lifecycle facts (always-mint identity)', () => {
  it('a started/ended pair shares a node key, pairs deterministic ids, and computes parentage', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      const runCtx = { runId: 'run-lc', surface: 'agent', base: 'run', name: "agent run: 'lc'" } as const;
      emitLifecycleFact('started', { ...runCtx, threadId: 't-lc', definitionIds: ['agent:lc'] });
      emitLifecycleFact('started', {
        runId: 'run-lc',
        surface: 'model',
        base: 'generate',
        parent: { surface: 'agent', base: 'run' },
      });
      emitLifecycleFact('ended', { ...runCtx, output: true });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    const [runStart, genStart, runEnd] = c.pulses;
    expect(runStart).toMatchObject({
      id: mintFactId('run-lc', 'agent', 'run', 'started'),
      action: 'run_started',
      traceId: 'run-lc', // the run IS the flow
      spanId: 'agent.run.0',
      threadId: 't-lc',
      source: 'native',
    });
    expect(runEnd).toMatchObject({
      id: mintFactId('run-lc', 'agent', 'run', 'ended'),
      action: 'run_completed',
      type: 'output',
      spanId: 'agent.run.0', // same node key → readers pair the two
    });
    expect(genStart.parentSpanId).toBe('agent.run.0');
    expect(
      c.edges.some(e => e.type === 'parent_of' && e.from.id === runStart.id && e.to.id === genStart.id),
      'computed parent_of arrow',
    ).toBe(true);
    expect(c.edges.some(e => e.type === 'origin_of' && e.to.id === 'run-lc')).toBe(true);
    expect(c.edges.some(e => e.type === 'uses_definition' && e.to.id === 'agent:lc')).toBe(true);
  });

  it('the same facts derive a complete flow in the idempotent store — even when written twice', async () => {
    const bus = new PulseBus();
    const rows = collect(bus);
    registerPulseEmitter(bus);
    try {
      emitLifecycleFact('started', { runId: 'run-rp', surface: 'agent', base: 'run', threadId: 't-rp' });
      emitLifecycleFact('ended', { runId: 'run-rp', surface: 'agent', base: 'run', output: true });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    const store = new InMemoryPulseStorage();
    await store.batchCreatePulses(rows.pulses);
    await store.batchCreatePulses(rows.pulses); // replay after a lost ack
    const { flows } = await store.listFlows();
    expect(flows).toHaveLength(1);
    expect(flows[0]).toMatchObject({ flowId: 'run-rp', status: 'completed', pulseCount: 2, threadId: 't-rp' });
  });

  it('error ends become *_failed error facts', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      emitLifecycleFact('ended', { runId: 'run-e', surface: 'agent', base: 'run', error: true });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(c.pulses[0]).toMatchObject({ action: 'run_failed', type: 'error', level: 'error', source: 'native' });
  });
});

describe('site context extras', () => {
  it('site attributes ride the fact (model/provider for price resolution)', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      emitLifecycleFact('ended', {
        runId: 'run-lc',
        surface: 'model',
        base: 'generate',
        output: true,
        attributes: { model: 'gpt-4o-mini', provider: 'openai.responses' },
      });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(c.pulses[0]?.attributes).toMatchObject({ model: 'gpt-4o-mini', provider: 'openai.responses' });
  });

  it('a terminal status names its action: aborted ends as run_aborted', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      emitLifecycleFact('ended', { runId: 'run-m', surface: 'agent', base: 'run', status: 'aborted' });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(c.pulses.map(p => p.action)).toEqual(['run_aborted']);
    // A suspended run is NOT terminal — the action says so and readers keep the flow open.
    expect(c.pulses.every(p => p.type === 'state')).toBe(true);
  });

  it('a suspend does not occupy the terminal slot — the real end lands beside it', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      emitLifecycleFact('ended', { runId: 'run-sr', surface: 'agent', base: 'run', status: 'suspended' });
      // ...the run resumes and truly finishes later:
      emitLifecycleFact('ended', { runId: 'run-sr', surface: 'agent', base: 'run', output: true });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(c.pulses.map(p => p.action)).toEqual(['run_suspended', 'run_completed']);
    expect(c.pulses[0]!.id).not.toBe(c.pulses[1]!.id);
  });

  it('emission falls back to the ambient run context', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      await withPulseRun({ runId: 'ambient-run', threadId: 'amb-t' }, async () => {
        emitLifecycleFact('started', {
          runId: undefined,
          surface: 'memory',
          base: 'operation',
          occurrence: 'recall',
          name: 'memory: recall',
        });
      });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(c.pulses[0]).toMatchObject({
      surface: 'memory',
      action: 'operation_started',
      runId: 'ambient-run',
      traceId: 'ambient-run',
      threadId: 'amb-t',
    });
  });

  it('string occurrences mint distinct deterministic ids', () => {
    expect(mintFactId('r', 'tool', 'call', 'started', 'call-1')).toBe(
      mintFactId('r', 'tool', 'call', 'started', 'call-1'),
    );
    expect(mintFactId('r', 'tool', 'call', 'started', 'call-1')).not.toBe(
      mintFactId('r', 'tool', 'call', 'started', 'call-2'),
    );
  });
});
