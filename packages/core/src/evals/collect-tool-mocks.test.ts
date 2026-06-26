import { describe, expect, it } from 'vitest';
import { collectToolMocks } from './collect-tool-mocks';
import type { TrajectoryStep } from './types';

describe('collectToolMocks', () => {
  it('maps tool_call and mcp_tool_call steps to item tool mocks in order, stripping span-name labels', () => {
    const steps: TrajectoryStep[] = [
      { name: "tool: 'getWeather'", stepType: 'tool_call', toolArgs: { city: 'Seattle' }, toolResult: { temp: 52 } },
      {
        name: "mcp_tool: 'search' on 'docs-server'",
        stepType: 'mcp_tool_call',
        toolArgs: { q: 'forecast' },
        toolResult: { hits: ['a'] },
      },
    ];

    expect(collectToolMocks(steps)).toEqual([
      { toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } },
      { toolName: 'search', args: { q: 'forecast' }, output: { hits: ['a'] } },
    ]);
  });

  it('falls back to the raw label when it does not match the tool span-name format', () => {
    const steps: TrajectoryStep[] = [
      { name: 'weatherInfo', stepType: 'tool_call', toolArgs: { city: 'Paris' }, toolResult: { temp: 18 } },
    ];

    expect(collectToolMocks(steps)).toEqual([
      { toolName: 'weatherInfo', args: { city: 'Paris' }, output: { temp: 18 } },
    ]);
  });

  it('walks non-tool container children depth-first to preserve recorded call order', () => {
    const steps: TrajectoryStep[] = [
      { name: 'first', stepType: 'tool_call', toolArgs: {}, toolResult: { v: 1 } },
      {
        name: 'agent',
        stepType: 'agent_run',
        children: [
          { name: 'nested', stepType: 'tool_call', toolArgs: { x: 1 }, toolResult: { v: 2 } },
          { name: 'deeper', stepType: 'workflow_step', children: [{ name: 'leaf', stepType: 'tool_call' }] },
        ],
      },
    ];

    expect(collectToolMocks(steps).map(m => m.toolName)).toEqual(['first', 'nested', 'leaf']);
  });

  it('collects the sub-agent delegation call but not its internal tool calls', () => {
    const steps: TrajectoryStep[] = [
      {
        name: "tool: 'agent-balanceAgent'",
        stepType: 'tool_call',
        toolArgs: { prompt: 'look up YJ balance' },
        toolResult: { text: 'The account balance for YJ is 100.' },
        children: [
          // The sub-agent's own internal tool call — must be skipped, it never
          // reaches the parent agent's tool-mock matcher.
          {
            name: "tool: 'lookupBalance'",
            stepType: 'tool_call',
            toolArgs: { user: 'YJ' },
            toolResult: { balance: 100 },
          },
        ],
      },
    ];

    expect(collectToolMocks(steps)).toEqual([
      {
        toolName: 'agent-balanceAgent',
        args: { prompt: 'look up YJ balance' },
        output: { text: 'The account balance for YJ is 100.' },
        matchArgs: 'ignore',
      },
    ]);
  });

  it('does not set matchArgs for ordinary (non-sub-agent) tool calls', () => {
    const steps: TrajectoryStep[] = [
      { name: "tool: 'getWeather'", stepType: 'tool_call', toolArgs: { city: 'Seattle' }, toolResult: { temp: 52 } },
    ];
    const [mock] = collectToolMocks(steps);
    expect(mock).toEqual({ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } });
    expect(mock && 'matchArgs' in mock).toBe(false);
  });

  it('ignores non-tool steps and defaults missing args to an empty object', () => {
    const steps: TrajectoryStep[] = [
      { name: 'gen', stepType: 'model_generation' },
      { name: 'noArgs', stepType: 'tool_call', toolResult: { ok: true } },
    ];

    expect(collectToolMocks(steps)).toEqual([{ toolName: 'noArgs', args: {}, output: { ok: true } }]);
  });

  it('returns an empty array for undefined or empty steps', () => {
    expect(collectToolMocks(undefined)).toEqual([]);
    expect(collectToolMocks([])).toEqual([]);
  });
});
