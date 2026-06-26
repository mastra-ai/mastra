import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAgentTools, splitAgentTools } from '../agent-tool';

describe('buildAgentTools', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges tools and agents into a single AgentTool array', () => {
    const result = buildAgentTools({
      tools: { 'tool-a': { description: 'Tool A' } },
      agents: { 'agent-x': { name: 'Agent X', description: 'Useful agent' } },
    });

    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === 'tool-a')).toMatchObject({
      id: 'tool-a',
      name: 'tool-a',
      description: 'Tool A',
      type: 'tool',
      isChecked: false,
    });
    expect(result.find(r => r.id === 'agent-x')).toMatchObject({
      id: 'agent-x',
      name: 'Agent X',
      description: 'Useful agent',
      type: 'agent',
      isChecked: false,
    });
  });

  it('merges workflows into the AgentTool array with type "workflow"', () => {
    const result = buildAgentTools({
      tools: {},
      agents: {},
      workflows: { 'wf-1': { name: 'Workflow One', description: 'Does workflow things' } },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'wf-1',
      name: 'Workflow One',
      description: 'Does workflow things',
      type: 'workflow',
      isChecked: false,
    });
  });

  it('derives isChecked from the selected maps', () => {
    const result = buildAgentTools({
      tools: { 'tool-a': {} },
      agents: { 'agent-x': { name: 'Agent X' } },
      workflows: { 'wf-1': { name: 'Workflow' } },
      selected: {
        tools: { 'tool-a': true },
        agents: { 'agent-x': true },
        workflows: { 'wf-1': true },
      },
    });

    expect(result.find(r => r.id === 'tool-a')?.isChecked).toBe(true);
    expect(result.find(r => r.id === 'agent-x')?.isChecked).toBe(true);
    expect(result.find(r => r.id === 'wf-1')?.isChecked).toBe(true);
  });

  it('treats falsy/missing entries in selected maps as unchecked', () => {
    const result = buildAgentTools({
      tools: { 'tool-a': {} },
      agents: { 'agent-x': { name: 'Agent X' } },
      workflows: { 'wf-1': { name: 'Workflow' } },
      selected: {
        tools: { 'tool-a': false },
        agents: {},
        workflows: { 'wf-1': false },
      },
    });

    expect(result.find(r => r.id === 'tool-a')?.isChecked).toBe(false);
    expect(result.find(r => r.id === 'agent-x')?.isChecked).toBe(false);
    expect(result.find(r => r.id === 'wf-1')?.isChecked).toBe(false);
  });

  it('warns and lets the agent win when an id collides between tool and agent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = buildAgentTools({
      tools: { collide: { description: 'tool description' } },
      agents: { collide: { name: 'Collide Agent', description: 'agent description' } },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'collide',
      name: 'Collide Agent',
      description: 'agent description',
      type: 'agent',
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('lets the agent win and warns when an id collides between agent and workflow', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = buildAgentTools({
      tools: {},
      agents: { collide: { name: 'Collide Agent', description: 'agent description' } },
      workflows: { collide: { name: 'Collide Workflow', description: 'workflow description' } },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'collide',
      type: 'agent',
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('lets the workflow win over a tool with the same id and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = buildAgentTools({
      tools: { collide: { description: 'tool description' } },
      agents: {},
      workflows: { collide: { name: 'Collide Workflow', description: 'workflow description' } },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'collide',
      name: 'Collide Workflow',
      type: 'workflow',
    });
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('splitAgentTools', () => {
  it('routes checked items to tools, agents, or workflows based on type', () => {
    const result = splitAgentTools([
      { id: 'tool-a', name: 'tool-a', isChecked: true, type: 'tool' },
      { id: 'tool-b', name: 'tool-b', isChecked: false, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', isChecked: true, type: 'agent' },
      { id: 'agent-y', name: 'Agent Y', isChecked: false, type: 'agent' },
      { id: 'wf-1', name: 'Workflow', isChecked: true, type: 'workflow' },
      { id: 'wf-2', name: 'Workflow 2', isChecked: false, type: 'workflow' },
    ]);

    expect(result).toEqual({
      tools: { 'tool-a': true },
      agents: { 'agent-x': true },
      workflows: { 'wf-1': true },
    });
  });

  it('round-trips with buildAgentTools', () => {
    const items = buildAgentTools({
      tools: { 'tool-a': {} },
      agents: { 'agent-x': { name: 'Agent X' } },
      workflows: { 'wf-1': { name: 'Workflow' } },
      selected: {
        tools: { 'tool-a': true },
        agents: { 'agent-x': true },
        workflows: { 'wf-1': true },
      },
    });

    expect(splitAgentTools(items)).toEqual({
      tools: { 'tool-a': true },
      agents: { 'agent-x': true },
      workflows: { 'wf-1': true },
    });
  });
});
