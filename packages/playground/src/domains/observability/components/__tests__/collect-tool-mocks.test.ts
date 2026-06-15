import { describe, expect, it } from 'vitest';

import { collectToolMocks } from '../collect-tool-mocks';
import type { ToolCallTrajectoryStep } from '../collect-tool-mocks';

describe('collectToolMocks', () => {
  it('maps tool_call and mcp_tool_call steps to item tool mocks in order, stripping span-name labels', () => {
    const steps: ToolCallTrajectoryStep[] = [
      { name: "tool: 'getWeather'", stepType: 'tool_call', toolArgs: { city: 'Seattle' }, toolResult: { temp: 52 } },
      {
        name: "mcp_tool: 'search' on 'docs-server'",
        stepType: 'mcp_tool_call',
        toolArgs: { q: 'forecast' },
        toolResult: ['a'],
      },
    ];

    expect(collectToolMocks(steps)).toEqual([
      { toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } },
      { toolName: 'search', args: { q: 'forecast' }, output: ['a'] },
    ]);
  });

  it('falls back to the raw label when it does not match the tool span-name format', () => {
    const steps: ToolCallTrajectoryStep[] = [
      { name: 'weatherInfo', stepType: 'tool_call', toolArgs: { city: 'Paris' }, toolResult: { temp: 18 } },
    ];

    expect(collectToolMocks(steps)).toEqual([
      { toolName: 'weatherInfo', args: { city: 'Paris' }, output: { temp: 18 } },
    ]);
  });

  it('walks nested children depth-first to preserve recorded call order', () => {
    const steps: ToolCallTrajectoryStep[] = [
      { name: 'first', stepType: 'tool_call', toolArgs: {}, toolResult: 1 },
      {
        name: 'agent',
        stepType: 'agent_run',
        children: [
          { name: 'nested', stepType: 'tool_call', toolArgs: { x: 1 }, toolResult: 2 },
          { name: 'deeper', stepType: 'workflow_step', children: [{ name: 'leaf', stepType: 'tool_call' }] },
        ],
      },
    ];

    expect(collectToolMocks(steps).map(m => m.toolName)).toEqual(['first', 'nested', 'leaf']);
  });

  it('ignores non-tool steps and defaults missing args to an empty object', () => {
    const steps: ToolCallTrajectoryStep[] = [
      { name: 'gen', stepType: 'model_generation' },
      { name: 'noArgs', stepType: 'tool_call', toolResult: 'ok' },
    ];

    expect(collectToolMocks(steps)).toEqual([{ toolName: 'noArgs', args: {}, output: 'ok' }]);
  });

  it('returns an empty array for undefined or empty steps', () => {
    expect(collectToolMocks(undefined)).toEqual([]);
    expect(collectToolMocks([])).toEqual([]);
  });
});
