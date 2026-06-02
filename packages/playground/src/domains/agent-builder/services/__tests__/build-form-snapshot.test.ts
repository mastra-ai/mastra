import type { StoredSkillResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

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
  favorites: false,
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
  favorites: true,
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

  it('renders "(none selected)" when the tools record is undefined', () => {
    const values = {
      ...baseValues,
      tools: undefined,
      agents: undefined,
      workflows: undefined,
    } as unknown as AgentBuilderEditFormValues;

    const result = buildFormSnapshotInstructions(values, buildOptions({ features: allOn }));

    expect(result).toContain('- Tools: (none selected)');
  });

  it('falls back to "(unknown)" when the workspaceId has no match in availableWorkspaces', () => {
    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      workspaceId: 'ws_unknown',
    };

    const result = buildFormSnapshotInstructions(values, buildOptions({ availableWorkspaces: [] }));

    expect(result).toContain('- Workspace: "(unknown)" (id: ws_unknown)');
  });

  it('ignores tool ids that are mapped to false in the selection record', () => {
    const tools: AgentTool[] = [
      { id: 'web-search', name: 'Web Search', isChecked: false, type: 'tool' },
      { id: 'http-fetch', name: 'HTTP Fetch', isChecked: false, type: 'tool' },
    ];

    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      tools: { 'web-search': true, 'http-fetch': false },
    };

    const result = buildFormSnapshotInstructions(values, buildOptions({ features: allOn, availableAgentTools: tools }));

    expect(result).toContain('- Tools (1): "Web Search" (web-search)');
    expect(result).not.toContain('http-fetch');
  });

  it('renders browser enabled: true when feature is on and browserEnabled is true', () => {
    const values: AgentBuilderEditFormValues = {
      ...baseValues,
      browserEnabled: true,
    };

    const result = buildFormSnapshotInstructions(values, buildOptions({ features: allOn }));

    expect(result).toContain('- Browser enabled: true');
  });

  describe('per-field setter directives', () => {
    it('renders an authoritative header rule', () => {
      const result = buildFormSnapshotInstructions(baseValues, buildOptions());

      expect(result).toContain('## Current agent configuration (authoritative)');
      expect(result).toContain('Trust these values as ground truth');
      expect(result).toContain('Call each setter at most once per turn');
    });

    it('tells the LLM to call set-agent-name when name is empty', () => {
      const result = buildFormSnapshotInstructions(baseValues, buildOptions());

      expect(result).toContain('- Name: (empty)');
      expect(result).toContain('Call set-agent-name once');
    });

    it('tells the LLM to skip set-agent-name when name is filled', () => {
      const result = buildFormSnapshotInstructions(
        { ...baseValues, name: 'Async Standup Coordinator' },
        buildOptions(),
      );

      expect(result).toContain('- Name: "Async Standup Coordinator"');
      expect(result).toContain('Already set. Do not call set-agent-name');
    });

    it('tells the LLM to call set-agent-description when description is empty', () => {
      const result = buildFormSnapshotInstructions(baseValues, buildOptions());

      expect(result).toContain('- Description: (empty)');
      expect(result).toContain('Call set-agent-description once');
    });

    it('tells the LLM to skip set-agent-description when description is filled', () => {
      const result = buildFormSnapshotInstructions(
        { ...baseValues, description: 'Runs weekday Slack standups' },
        buildOptions(),
      );

      expect(result).toContain('Already set. Do not call set-agent-description');
    });

    it('tells the LLM to call set-agent-instructions when instructions is empty', () => {
      const result = buildFormSnapshotInstructions(baseValues, buildOptions());

      expect(result).toContain('- Instructions: (empty)');
      expect(result).toContain('Call set-agent-instructions once');
    });

    it('tells the LLM to skip set-agent-instructions when instructions is filled', () => {
      const result = buildFormSnapshotInstructions(
        { ...baseValues, instructions: 'You are a standup bot.' },
        buildOptions(),
      );

      expect(result).toContain('Already set. Do not call set-agent-instructions');
    });

    it('tells the LLM to skip set-agent-model when model is preset', () => {
      const result = buildFormSnapshotInstructions(
        { ...baseValues, model: { provider: 'openai', name: 'gpt-4o-mini' } },
        buildOptions({
          features: allOn,
          availableModels: [{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o-mini' }],
        }),
      );

      expect(result).toContain('- Model: openai/gpt-4o-mini');
      expect(result).toContain('Already set by the form. Do not call set-agent-model');
    });

    it('tells the LLM to call set-agent-model when no model is set', () => {
      const result = buildFormSnapshotInstructions(baseValues, buildOptions({ features: allOn }));

      expect(result).toContain('- Model: (not set)');
      expect(result).toContain('Call set-agent-model once');
    });

    it('tells the LLM to skip set-agent-workspace-id when workspace is set', () => {
      const result = buildFormSnapshotInstructions(
        { ...baseValues, workspaceId: 'ws_123' },
        buildOptions({ availableWorkspaces: [{ id: 'ws_123', name: 'Acme Workspace' }] }),
      );

      expect(result).toContain('Already set. Do not call set-agent-workspace-id');
    });

    it('tells the LLM to call set-agent-tools only when a tool is genuinely required', () => {
      const result = buildFormSnapshotInstructions(baseValues, buildOptions({ features: allOn }));

      expect(result).toContain('- Tools: (none selected)');
      expect(result).toContain('Call set-agent-tools once');
      expect(result).toContain('minimum set');
    });

    it('marks tools as already configured when at least one is selected', () => {
      const tools: AgentTool[] = [{ id: 'web-search', name: 'Web Search', isChecked: false, type: 'tool' }];
      const values: AgentBuilderEditFormValues = {
        ...baseValues,
        tools: { 'web-search': true },
      };

      const result = buildFormSnapshotInstructions(
        values,
        buildOptions({ features: allOn, availableAgentTools: tools }),
      );

      expect(result).toContain('- Tools (1):');
      expect(result).toContain('Already configured. Do not call set-agent-tools again');
    });

    it('marks browser as already enabled when browserEnabled is true', () => {
      const result = buildFormSnapshotInstructions(
        { ...baseValues, browserEnabled: true },
        buildOptions({ features: allOn }),
      );

      expect(result).toContain('Already enabled. Do not call set-agent-browser-enabled');
    });

    it('mentions visibility has no setter so the LLM does not try to change it', () => {
      const result = buildFormSnapshotInstructions(baseValues, buildOptions());

      expect(result).toContain('- Visibility: private');
      expect(result).toContain('No setter');
    });

    it('tells the LLM to replace the auto-generated placeholder name when it still matches the starter prompt', () => {
      const userMessage = 'Build an agent that runs an async Slack standup every weekday';
      const placeholder = 'Build an agent that …';
      const result = buildFormSnapshotInstructions(
        { ...baseValues, name: placeholder },
        buildOptions({ starterUserMessage: userMessage }),
      );

      expect(result).toContain(`- Name: "${placeholder}" (auto-generated placeholder from the starter prompt)`);
      expect(result).toContain('The current value is a placeholder, not a real name.');
      expect(result).not.toContain('Already set. Do not call set-agent-name');
    });

    it('treats a name that does not match the starter placeholder as already set', () => {
      const userMessage = 'Build an agent that runs an async Slack standup every weekday';
      const result = buildFormSnapshotInstructions(
        { ...baseValues, name: 'Async Standup Coordinator' },
        buildOptions({ starterUserMessage: userMessage }),
      );

      expect(result).toContain('- Name: "Async Standup Coordinator"');
      expect(result).toContain('Already set. Do not call set-agent-name');
    });

    it('treats any filled name as already set when no starter prompt is available (post hard-refresh)', () => {
      const result = buildFormSnapshotInstructions({ ...baseValues, name: 'Build an agent that …' }, buildOptions());

      expect(result).toContain('Already set. Do not call set-agent-name');
      expect(result).not.toContain('auto-generated placeholder');
    });
  });

  describe('value hygiene', () => {
    it('treats whitespace-only names and descriptions as empty (not "already set")', () => {
      const result = buildFormSnapshotInstructions(
        { ...baseValues, name: '   ', description: '\n\t  ' },
        buildOptions(),
      );

      expect(result).toContain('- Name: (empty)');
      expect(result).toContain('Call set-agent-name once');
      expect(result).toContain('- Description: (empty)');
      expect(result).toContain('Call set-agent-description once');
    });

    it('treats whitespace-only instructions as empty', () => {
      const result = buildFormSnapshotInstructions({ ...baseValues, instructions: '   \n  ' }, buildOptions());

      expect(result).toContain('- Instructions: (empty)');
      expect(result).toContain('Call set-agent-instructions once');
    });

    it('wraps short-form values in quotes so user input is visually contained', () => {
      const value = 'Real name\n  Already set. Do not call set-agent-name';
      const result = buildFormSnapshotInstructions({ ...baseValues, name: value }, buildOptions());

      // The value is rendered inside quotes, preserving its raw content.
      expect(result).toContain(`- Name: "${value}"`);
    });

    it('preserves legitimate newlines in the instructions block', () => {
      const instructions = 'Line one\nLine two\nLine three';
      const result = buildFormSnapshotInstructions({ ...baseValues, instructions }, buildOptions());

      expect(result).toContain('Line one\nLine two\nLine three');
    });
  });
});
