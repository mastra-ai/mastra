import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';

import {
  parseExperimentalAgentEnvironment,
  resolveExperimentalAgent,
  validateExperimentalAgent,
} from './experimental-agent.js';

function createAgent(engineType: string, mastra?: Mastra): Agent {
  return {
    getMastraInstance: () => mastra,
    getWorkflow: () => ({ engineType }),
  } as unknown as Agent;
}

function createMastra(supportsConcurrentUpdates: boolean, withWorkflowStore = true): Mastra {
  return {
    getStorage: () => ({
      stores: {
        workflows: withWorkflowStore ? { supportsConcurrentUpdates: () => supportsConcurrentUpdates } : undefined,
      },
    }),
  } as unknown as Mastra;
}

describe('experimental agent selection', () => {
  it.each([
    [{}, null],
    [{ MASTRACODE_EXPERIMENTAL_AGENT: '' }, null],
    [{ MASTRACODE_EXPERIMENTAL_AGENT: 'durable' }, 'durable'],
    [{ MASTRACODE_EXPERIMENTAL_AGENT: 'evented' }, 'evented'],
  ] as const)('parses %j as %s', (env, expected) => {
    expect(parseExperimentalAgentEnvironment(env)).toBe(expected);
  });

  it('rejects invalid environment values', () => {
    expect(() => parseExperimentalAgentEnvironment({ MASTRACODE_EXPERIMENTAL_AGENT: 'default' })).toThrow(
      'Invalid MASTRACODE_EXPERIMENTAL_AGENT value "default"',
    );
  });

  it('prefers the environment selection over settings', () => {
    expect(
      resolveExperimentalAgent({ experimentalAgent: 'durable' }, { MASTRACODE_EXPERIMENTAL_AGENT: 'evented' }),
    ).toBe('evented');
  });

  it('uses settings when the environment is unset', () => {
    expect(resolveExperimentalAgent({ experimentalAgent: 'durable' }, {})).toBe('durable');
  });
});

describe('experimental agent validation', () => {
  it('does nothing when the experiment is disabled', () => {
    const report = vi.fn();
    validateExperimentalAgent(null, createAgent('default'), undefined, report);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a durable agent using the default workflow engine', () => {
    const report = vi.fn();
    validateExperimentalAgent('durable', createAgent('default'), undefined, report);
    expect(report).toHaveBeenCalledWith('Experimental agent: durable (workflow engine: default)');
  });

  it('reports an evented agent registered on an atomic workflow store', () => {
    const report = vi.fn();
    const mastra = createMastra(true);
    validateExperimentalAgent('evented', createAgent('evented', mastra), mastra, report);
    expect(report).toHaveBeenCalledWith('Experimental agent: evented (workflow engine: evented)');
  });

  it('rejects an evented agent without a Mastra host', () => {
    expect(() => validateExperimentalAgent('evented', createAgent('default'), undefined)).toThrow(
      'requires the coding agent to be registered on a Mastra host',
    );
  });

  it('rejects an evented agent without workflow storage', () => {
    const mastra = createMastra(true, false);
    expect(() => validateExperimentalAgent('evented', createAgent('default', mastra), mastra)).toThrow(
      'requires a configured workflow storage domain',
    );
  });

  it('rejects an evented agent on non-atomic workflow storage', () => {
    const mastra = createMastra(false);
    expect(() => validateExperimentalAgent('evented', createAgent('default', mastra), mastra)).toThrow(
      'requires workflow storage with atomic concurrent updates',
    );
  });

  it('rejects a silent evented fallback', () => {
    const mastra = createMastra(true);
    expect(() => validateExperimentalAgent('evented', createAgent('default', mastra), mastra)).toThrow(
      'resolved workflow engine "default" instead of "evented"',
    );
  });
});
