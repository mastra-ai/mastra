import { describe, expect, it } from 'vitest';
import { AGENT_EXECUTION_OPTION_COMPOSERS, mergeAgentExecutionOptions } from './merge-execution-options';

describe('mergeAgentExecutionOptions', () => {
  it('does not carry logical message identity from reusable defaults', () => {
    const defaultIdentity = { input: 'default-input', response: 'default-response' };
    const callerIdentity = { input: 'call-input', response: 'call-response' };

    expect(mergeAgentExecutionOptions({ logicalMessageIdentity: defaultIdentity }, { maxSteps: 1 })).not.toHaveProperty(
      'logicalMessageIdentity',
    );
    expect(
      mergeAgentExecutionOptions(
        { logicalMessageIdentity: defaultIdentity },
        {
          logicalMessageIdentity: callerIdentity,
        },
      ),
    ).toMatchObject({ logicalMessageIdentity: callerIdentity });
  });

  it('keeps caller scalar options authoritative', () => {
    expect(mergeAgentExecutionOptions({ maxSteps: 8 }, { maxSteps: 1 })).toMatchObject({ maxSteps: 1 });
  });

  it('does not retain default tools in a caller replacement surface', () => {
    const adminTool = { execute: () => 'admin' };
    const safeTool = { execute: () => 'safe' };

    const merged = mergeAgentExecutionOptions(
      {
        toolsetsMode: 'replace',
        toolsets: { defaults: { adminTool } },
      },
      {
        toolsetsMode: 'replace',
        toolsets: { caller: { safeTool } },
      },
    );

    expect(merged.toolsets).toEqual({ caller: { safeTool } });
  });

  it('composes internal hooks after configured callbacks without exposing the composer marker', async () => {
    const calls: string[] = [];
    const configured = async () => {
      calls.push('configured');
      return { activeTools: ['safe'], workspace: 'configured-workspace' };
    };
    const merged = mergeAgentExecutionOptions(
      { prepareStep: configured },
      {
        [AGENT_EXECUTION_OPTION_COMPOSERS]: () => ({
          prepareStep: (existing: typeof configured | undefined) => async () => {
            const prepared = await existing?.();
            calls.push('internal');
            return { ...prepared, activeTools: [] };
          },
        }),
      },
    );

    await expect(merged.prepareStep()).resolves.toEqual({ activeTools: [], workspace: 'configured-workspace' });
    expect(calls).toEqual(['configured', 'internal']);
    // The run-local factory remains internal symbol metadata so an enclosing
    // stream/resume boundary can create a fresh composition.
    expect(Reflect.ownKeys(merged)).toContain(AGENT_EXECUTION_OPTION_COMPOSERS);
  });

  it('does not let internal hook composition change the caller step budget', () => {
    const composer = {
      [AGENT_EXECUTION_OPTION_COMPOSERS]: () => ({
        recoveryMaxSteps: 1,
        onIterationComplete: (existing: unknown) => existing,
      }),
    };

    expect(mergeAgentExecutionOptions({ maxSteps: 1000 }, composer)).toMatchObject({
      maxSteps: 1000,
      recoveryMaxSteps: 1,
    });
    expect(mergeAgentExecutionOptions({}, composer).maxSteps).toBeUndefined();
  });

  it('creates a fresh internal hook composition when already-merged caller options are merged again', async () => {
    const calls: string[] = [];
    const configured = async () => {
      calls.push('configured');
      return { continue: true };
    };
    let composerInstance = 0;
    const callerOptions = {
      onIterationComplete: configured,
      [AGENT_EXECUTION_OPTION_COMPOSERS]: () => {
        const instance = ++composerInstance;
        return {
          onIterationComplete: (existing: typeof configured | undefined) => async () => {
            calls.push(`internal-${instance}`);
            return existing?.();
          },
        };
      },
    };

    const firstMerge = mergeAgentExecutionOptions({}, callerOptions);
    const secondMerge = mergeAgentExecutionOptions({}, firstMerge);

    await secondMerge.onIterationComplete();
    expect(calls).toEqual(['internal-2', 'configured']);
    expect(composerInstance).toBe(2);
  });
});
