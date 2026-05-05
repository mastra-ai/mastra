import { describe, expect, it } from 'vitest';

import type { StoredSkillResponse } from '@mastra/client-js';

import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { buildFormSnapshotInstructions } from '../build-form-snapshot';
import type { AvailableWorkspaceLike, BuildFormSnapshotOptions } from '../build-form-snapshot';
import type { ModelInfo } from '@/domains/llm';

type Features = ReturnType<typeof useBuilderAgentFeatures>;

const allOff: Features = {
  tools: false,
  memory: false,
  workflows: false,
  agents: false,
  avatarUpload: false,
  skills: false,
  model: false,
  stars: false,
  browser: false,
};
const allOn: Features = {
  tools: true,
  memory: true,
  workflows: true,
  agents: true,
  avatarUpload: true,
  skills: true,
  model: true,
  stars: true,
  browser: true,
};

const baseValues: AgentBuilderEditFormValues = {
  name: '',
  description: '',
  instructions: '',
  tools: {},
  agents: {},
  workflows: {},
  skills: {},
};

const buildOptions = (overrides: Partial<BuildFormSnapshotOptions> = {}): BuildFormSnapshotOptions => ({
  availableAgentTools: [] as AgentTool[],
  availableSkills: [] as StoredSkillResponse[],
  availableWorkspaces: [] as AvailableWorkspaceLike[],
  availableModels: [] as ModelInfo[],
  features: allOff,
  ...overrides,
});

describe('buildFormSnapshotInstructions', () => {
  it('renders empty/not-set placeholders for an empty form', () => {
    const result = buildFormSnapshotInstructions(baseValues, buildOptions());

    expect(result).toContain('- Name: (empty)');
    expect(result).toContain('- Description: (empty)');
    expect(result).toContain('- Instructions: (empty)');
    expect(result).toContain('- Workspace: (not set)');
    expect(result).toContain('- Visibility: private');
  });

  it('omits feature-gated sections when disabled', () => {
    const result = buildFormSnapshotInstructions(baseValues, buildOptions({ features: allOff }));

    expect(result).not.toContain('- Model:');
    expect(result).not.toContain('- Tools');
    expect(result).not.toContain('- Skills');
    expect(result).not.toContain('- Browser enabled:');
  });

  it('shows feature-gated sections when enabled', () => {
    const result = buildFormSnapshotInstructions(baseValues, buildOptions({ features: allOn }));

    expect(result).toContain('- Model: (not set)');
    expect(result).toContain('- Tools: (none selected)');
    expect(result).toContain('- Skills: (none selected)');
    expect(result).toContain('- Browser enabled: false');
  });

  it('resolves selected tool ids to display names and drops unknown ids', () => {
    const tools: AgentTool[] = [
      { id: 'web-search', name: 'Web Search', isChecked: false, type: 'tool' },
      { id: 'http-fetch', name: 'HTTP Fetch', isChecked: false, type: 'tool' },
      { id: 'agent-x', name: 'Agent X', isChecked: false, type: 'agent' },
    ];

    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      name: 'Bot',
      instructions: 'Help users',
      tools: { 'web-search': true, 'unknown-tool': true },
      agents: { 'agent-x': true },
    };

    const result = buildFormSnapshotInstructions(values, buildOptions({ features: allOn, availableAgentTools: tools }));

    expect(result).toContain('- Tools (2):');
    expect(result).toContain('"Web Search" (web-search)');
    expect(result).toContain('"Agent X" (agent-x)');
    expect(result).not.toContain('unknown-tool');
    expect(result).not.toContain('"HTTP Fetch"');
  });

  it('resolves selected skill ids to display names', () => {
    const skills: StoredSkillResponse[] = [
      {
        id: 'skill_42',
        name: 'Triage',
        instructions: '...',
        status: 'ready',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
      {
        id: 'skill_99',
        name: 'Other',
        instructions: '...',
        status: 'ready',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];

    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      skills: { skill_42: true, missing: true },
    };

    const result = buildFormSnapshotInstructions(values, buildOptions({ features: allOn, availableSkills: skills }));

    expect(result).toContain('- Skills (1): "Triage" (skill_42)');
    expect(result).not.toContain('skill_99');
    expect(result).not.toContain('missing');
  });

  it('truncates long instructions and appends [truncated]', () => {
    const longInstructions = 'a'.repeat(2000);
    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      instructions: longInstructions,
    };

    const result = buildFormSnapshotInstructions(values, buildOptions());

    expect(result).toContain('[truncated]');
    expect(result).not.toContain('a'.repeat(2000));
    expect(result).toContain('a'.repeat(1500));
  });

  it('renders model as provider/name when set and feature is enabled', () => {
    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      model: { provider: 'openai', name: 'gpt-4o-mini' },
    };
    const models: ModelInfo[] = [{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o-mini' }];

    const result = buildFormSnapshotInstructions(values, buildOptions({ features: allOn, availableModels: models }));

    expect(result).toContain('- Model: openai/gpt-4o-mini');
    expect(result).not.toContain('not in available models list');
  });

  it('marks the model with a note when the selection is not in the catalog', () => {
    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      model: { provider: 'anthropic', name: 'claude-opus-4-7' },
    };

    const result = buildFormSnapshotInstructions(values, buildOptions({ features: allOn, availableModels: [] }));

    expect(result).toContain('- Model: anthropic/claude-opus-4-7 (not in available models list)');
  });

  it('drops the model section entirely when the model feature is off', () => {
    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      model: { provider: 'openai', name: 'gpt-4o-mini' },
    };

    const result = buildFormSnapshotInstructions(values, buildOptions({ features: allOff }));

    expect(result).not.toContain('- Model:');
  });

  it('renders workspace by name when known', () => {
    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      workspaceId: 'ws_123',
    };
    const workspaces = [{ id: 'ws_123', name: 'Acme Workspace' }];

    const result = buildFormSnapshotInstructions(values, buildOptions({ availableWorkspaces: workspaces }));

    expect(result).toContain('- Workspace: "Acme Workspace" (id: ws_123)');
  });

  it('renders quoted name and description when set', () => {
    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      name: 'Customer Support Bot',
      description: 'Helps users reset passwords',
    };

    const result = buildFormSnapshotInstructions(values, buildOptions());

    expect(result).toContain('- Name: "Customer Support Bot"');
    expect(result).toContain('- Description: "Helps users reset passwords"');
  });
});
