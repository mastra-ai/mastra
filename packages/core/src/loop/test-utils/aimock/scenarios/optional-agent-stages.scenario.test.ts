import { describe, expect, it, vi } from 'vitest';
import type { Mastra } from '../../../../mastra';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: optional agent stages storage baseline', () => {
  const getMock = useLoopScenarioAimock();

  it('runs the direct engine and records workflow snapshot traffic', async () => {
    const llm = getMock();
    const shared = await createSharedAgent(llm);
    const mastra: Mastra = shared.mastra;
    const workflowsStore = await mastra.getStorage()?.getStore('workflows');

    if (!workflowsStore) throw new Error('AIMock agent did not create a workflows store');

    const counts = {
      fullReads: 0,
      authorityFullReads: 0,
      compactChecks: 0,
      authorityCompactChecks: 0,
      pendingWrites: 0,
      deletions: 0,
    };
    const graphLengths = new Set<number>();
    const recordGraphLength = (workflowName: string, snapshot: unknown) => {
      if (workflowName !== 'executionWorkflow' || !snapshot || typeof snapshot !== 'object') return;
      if (!('serializedStepGraph' in snapshot)) return;
      const graph = snapshot.serializedStepGraph;
      if (Array.isArray(graph)) graphLengths.add(graph.length);
    };
    const originalLoad = workflowsStore.loadWorkflowSnapshot.bind(workflowsStore);
    const originalPersist = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
    const originalRemove = workflowsStore.deleteWorkflowRunById.bind(workflowsStore);
    const load = vi.spyOn(workflowsStore, 'loadWorkflowSnapshot').mockImplementation(async args => {
      counts.fullReads++;
      if (new Error().stack?.includes('getAuthoritativeExecutionDisposition')) counts.authorityFullReads++;
      const snapshot = await originalLoad(args);
      recordGraphLength(args.workflowName, snapshot);
      return snapshot;
    });
    const originalCompact = workflowsStore.getWorkflowExecutionState.bind(workflowsStore);
    const compact = vi.spyOn(workflowsStore, 'getWorkflowExecutionState').mockImplementation(async args => {
      counts.compactChecks++;
      if (new Error().stack?.includes('getAuthoritativeExecutionDisposition')) counts.authorityCompactChecks++;
      return originalCompact(args);
    });
    const persist = vi.spyOn(workflowsStore, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.snapshot.status === 'pending') counts.pendingWrites++;
      recordGraphLength(args.workflowName, args.snapshot);
      return originalPersist(args);
    });
    const remove = vi.spyOn(workflowsStore, 'deleteWorkflowRunById').mockImplementation(async args => {
      counts.deletions++;
      return originalRemove(args);
    });

    const previousEvented = process.env.MASTRA_EVENTED_EXECUTION;
    vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'false');
    try {
      const { output, requests } = await runLoopScenario({
        engine: 'normal',
        llm,
        sharedAgent: shared,
        prompt: 'Reply with the scripted text.',
        fixtures: mock => mock.on({ endpoint: 'chat' }, { content: 'optional stages baseline' }),
      });

      expect(await output.text).toBe('optional stages baseline');
      expect(requests).toHaveLength(1);
      const measured = { ...counts, graphLengths: [...graphLengths] };
      console.info(`OPTIONAL_AGENT_STAGES_BASELINE ${JSON.stringify(measured)}`);
      expect(measured).toEqual({
        fullReads: 4,
        authorityFullReads: 0,
        compactChecks: 21,
        authorityCompactChecks: 21,
        pendingWrites: 2,
        deletions: 3,
        graphLengths: [6],
      });
    } finally {
      load.mockRestore();
      compact.mockRestore();
      persist.mockRestore();
      remove.mockRestore();
      if (previousEvented === undefined) delete process.env.MASTRA_EVENTED_EXECUTION;
      else vi.stubEnv('MASTRA_EVENTED_EXECUTION', previousEvented);
      await mastra.shutdown();
    }
  });
});
