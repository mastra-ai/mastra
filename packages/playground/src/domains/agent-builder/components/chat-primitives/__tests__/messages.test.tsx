// @vitest-environment jsdom
import type { MastraUIMessage } from '@mastra/react';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageRow } from '../messages';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import {
  SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
  SET_AGENT_DESCRIPTION_TOOL_NAME,
  SET_AGENT_INSTRUCTIONS_TOOL_NAME,
  SET_AGENT_MODEL_TOOL_NAME,
  SET_AGENT_NAME_TOOL_NAME,
  SET_AGENT_SKILLS_TOOL_NAME,
  SET_AGENT_TOOLS_TOOL_NAME,
  SET_AGENT_WORKSPACE_ID_TOOL_NAME,
} from '@/domains/agent-builder/services/tool-constants';

type ToolPart = MastraUIMessage['parts'][number];

interface PrimitivesMock {
  agentId: string;
  toolsData: Record<string, { description?: string }>;
  agentsData: Record<string, { name?: string; description?: string }>;
  workflowsData: Record<string, { name?: string; description?: string }>;
  availableSkills: { id: string; name: string }[];
}

let primitivesMock: PrimitivesMock = {
  agentId: 'agent-1',
  toolsData: {},
  agentsData: {},
  workflowsData: {},
  availableSkills: [],
};

vi.mock('../../../contexts/agent-primitives-context', () => ({
  useAgentPrimitives: () => primitivesMock,
}));

vi.mock('../../../../agent-builder', () => ({
  useBuilderPickerVisibility: () => ({
    visibleTools: null,
    visibleAgents: null,
    visibleWorkflows: null,
  }),
}));

const FormWrapper = ({
  children,
  defaultValues,
}: {
  children: ReactNode;
  defaultValues?: Partial<AgentBuilderEditFormValues>;
}) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', description: '', instructions: '', ...defaultValues },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const renderRow = (parts: ToolPart[], defaultValues?: Partial<AgentBuilderEditFormValues>) =>
  render(
    <FormWrapper defaultValues={defaultValues}>
      <MessageRow message={buildMessage(parts)} />
    </FormWrapper>,
  );

const buildMessage = (parts: MastraUIMessage['parts']): MastraUIMessage => ({
  id: 'msg-1',
  role: 'assistant',
  parts,
});

describe('MessageRow dynamic-tool rendering', () => {
  beforeEach(() => {
    primitivesMock = {
      agentId: 'agent-1',
      toolsData: {},
      agentsData: {},
      workflowsData: {},
      availableSkills: [],
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the generic shimmer for non-builder dynamic tools', () => {
    const { container } = renderRow([
      {
        type: 'dynamic-tool',
        toolCallId: 'call-5',
        toolName: 'some-other-tool',
        state: 'output-available',
        input: { tools: [{ id: 'web-search', name: 'Web Search' }] },
        output: { success: true },
      } as ToolPart,
    ]);

    // Unknown dynamic tools render as a GenericTool ToolCard showing "Executing <toolName>".
    expect(container.textContent).toContain('Executing');
    expect(container.textContent).toContain('some-other-tool');
    expect(container.textContent).not.toContain('Web Search');
  });

  it('renders MessageSetAgentName for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-name',
          toolName: SET_AGENT_NAME_TOOL_NAME,
          state: 'output-available',
          input: { name: 'Acme Bot' },
          output: { success: true },
        } as ToolPart,
      ],
      { name: 'Acme Bot' },
    );
    expect(container.textContent).toContain('Setting the agent name:');
    expect(container.textContent).toContain('Acme Bot');
  });

  it('renders MessageSetAgentName for persisted tool part', () => {
    const { container } = renderRow(
      [
        {
          type: `tool-${SET_AGENT_NAME_TOOL_NAME}`,
          toolCallId: 'call-name-r',
          state: 'output-available',
          input: { name: 'Acme Bot' },
          output: { success: true },
        } as ToolPart,
      ],
      { name: 'Acme Bot' },
    );
    expect(container.textContent).toContain('Setting the agent name:');
    expect(container.textContent).toContain('Acme Bot');
  });

  it('renders MessageSetAgentDescription for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-desc',
          toolName: SET_AGENT_DESCRIPTION_TOOL_NAME,
          state: 'output-available',
          input: { description: 'A helpful research assistant.' },
          output: { success: true },
        } as ToolPart,
      ],
      { description: 'A helpful research assistant.' },
    );
    expect(container.textContent).toContain('Setting the agent description:');
    expect(container.textContent).toContain('A helpful research assistant.');
  });

  it('renders MessageSetAgentDescription for persisted tool part', () => {
    const { container } = renderRow(
      [
        {
          type: `tool-${SET_AGENT_DESCRIPTION_TOOL_NAME}`,
          toolCallId: 'call-desc-r',
          state: 'output-available',
          input: { description: 'A helpful research assistant.' },
          output: { success: true },
        } as ToolPart,
      ],
      { description: 'A helpful research assistant.' },
    );
    expect(container.textContent).toContain('Setting the agent description:');
    expect(container.textContent).toContain('A helpful research assistant.');
  });

  it('renders MessageSetAgentInstructions for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-instr',
          toolName: SET_AGENT_INSTRUCTIONS_TOOL_NAME,
          state: 'output-available',
          input: { instructions: 'Always answer in French.' },
          output: { success: true },
        } as ToolPart,
      ],
      { instructions: 'Always answer in French.' },
    );
    expect(container.textContent).toContain('Setting the agent instructions:');
    expect(container.textContent).toContain('Always answer in French.');
  });

  it('renders MessageSetAgentInstructions for persisted tool part', () => {
    const { container } = renderRow(
      [
        {
          type: `tool-${SET_AGENT_INSTRUCTIONS_TOOL_NAME}`,
          toolCallId: 'call-instr-r',
          state: 'output-available',
          input: { instructions: 'Always answer in French.' },
          output: { success: true },
        } as ToolPart,
      ],
      { instructions: 'Always answer in French.' },
    );
    expect(container.textContent).toContain('Setting the agent instructions:');
    expect(container.textContent).toContain('Always answer in French.');
  });

  // MVP follow-up: MessageSetAgentTools now reads integration tools via React
  // Query (`useAvailableAgentTools` → `useAllProviderTools`). The render
  // harness here does not wrap in QueryClientProvider + MSW. Re-enable as part
  // of the ToolProvider Connections follow-up.
  it.skip('MessageSetAgentTools shows only the checked tools/agents/workflows from the form', () => {
    primitivesMock = {
      ...primitivesMock,
      toolsData: { 'web-search': { description: 'Search' } },
      agentsData: { 'my-agent': { name: 'My Agent' } },
      workflowsData: { 'my-workflow': { name: 'My Workflow' } },
    };

    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-tools-mixed',
          toolName: SET_AGENT_TOOLS_TOOL_NAME,
          state: 'output-available',
          input: { tools: [] },
          output: { success: true },
        } as ToolPart,
      ],
      {
        tools: {},
        agents: { 'my-agent': true },
        workflows: { 'my-workflow': true },
      } as Partial<AgentBuilderEditFormValues>,
    );

    const text = container.textContent ?? '';
    expect(text).toContain('Enabling tools:');
    expect(text).toContain('My Agent');
    expect(text).toContain('My Workflow');
    expect(text).not.toContain('web-search');
  });

  // MVP follow-up: same React Query gap as the previous test.
  it.skip('MessageSetAgentTools renders "none" when nothing is selected', () => {
    primitivesMock = {
      ...primitivesMock,
      toolsData: { 'web-search': { description: 'Search' } },
    };

    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-tools-none',
          toolName: SET_AGENT_TOOLS_TOOL_NAME,
          state: 'output-available',
          input: { tools: [] },
          output: { success: true },
        } as ToolPart,
      ],
      { tools: {}, agents: {}, workflows: {} } as Partial<AgentBuilderEditFormValues>,
    );

    expect(container.textContent).toContain('Enabling tools: none');
  });

  it('MessageSetAgentSkills shows only the checked skills from the form', () => {
    primitivesMock = {
      ...primitivesMock,
      availableSkills: [
        { id: 'sk-1', name: 'Summarize' },
        { id: 'sk-2', name: 'Translate' },
      ],
    };

    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-skills',
          toolName: SET_AGENT_SKILLS_TOOL_NAME,
          state: 'output-available',
          input: { skills: [] },
          output: { success: true },
        } as ToolPart,
      ],
      { skills: { 'sk-1': true, 'sk-2': true } } as Partial<AgentBuilderEditFormValues>,
    );

    expect(container.textContent).toContain('Enabling skills:');
    expect(container.textContent).toContain('Summarize');
    expect(container.textContent).toContain('Translate');
  });

  it('MessageSetAgentSkills renders "none" when no skill is checked', () => {
    primitivesMock = {
      ...primitivesMock,
      availableSkills: [{ id: 'sk-1', name: 'Summarize' }],
    };

    const { container } = renderRow(
      [
        {
          type: `tool-${SET_AGENT_SKILLS_TOOL_NAME}`,
          toolCallId: 'call-skills-none',
          state: 'output-available',
          input: { skills: [] },
          output: { success: true },
        } as ToolPart,
      ],
      { skills: {} } as Partial<AgentBuilderEditFormValues>,
    );

    expect(container.textContent).toContain('Enabling skills: none');
  });

  it('renders MessageSetAgentModel for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-model',
          toolName: SET_AGENT_MODEL_TOOL_NAME,
          state: 'output-available',
          input: { model: { provider: 'openai', name: 'gpt-4o' } },
          output: { success: true },
        } as ToolPart,
      ],
      { model: { provider: 'openai', name: 'gpt-4o' } },
    );
    expect(container.textContent).toContain('Setting agent model to');
    expect(container.textContent).toContain('openai/gpt-4o');
  });

  it('renders MessageSetAgentModel for persisted tool part', () => {
    const { container } = renderRow(
      [
        {
          type: `tool-${SET_AGENT_MODEL_TOOL_NAME}`,
          toolCallId: 'call-model-r',
          state: 'output-available',
          input: { model: { provider: 'openai', name: 'gpt-4o' } },
          output: { success: true },
        } as ToolPart,
      ],
      { model: { provider: 'openai', name: 'gpt-4o' } },
    );
    expect(container.textContent).toContain('Setting agent model to');
    expect(container.textContent).toContain('openai/gpt-4o');
  });

  it('renders MessageSetAgentBrowserEnabled (enabled) for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-browser',
          toolName: SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
          state: 'output-available',
          input: { browserEnabled: true },
          output: { success: true },
        } as ToolPart,
      ],
      { browserEnabled: true },
    );
    expect(container.textContent).toContain('Browser access');
    expect(container.textContent).toContain('enabled');
  });

  it('renders MessageSetAgentBrowserEnabled (disabled) for persisted tool part', () => {
    const { container } = renderRow(
      [
        {
          type: `tool-${SET_AGENT_BROWSER_ENABLED_TOOL_NAME}`,
          toolCallId: 'call-browser-r',
          state: 'output-available',
          input: { browserEnabled: false },
          output: { success: true },
        } as ToolPart,
      ],
      { browserEnabled: false },
    );
    expect(container.textContent).toContain('Browser access');
    expect(container.textContent).toContain('disabled');
  });

  it('renders MessageSetAgentWorkspaceId for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-ws',
          toolName: SET_AGENT_WORKSPACE_ID_TOOL_NAME,
          state: 'output-available',
          input: { workspaceId: 'ws-123' },
          output: { success: true },
        } as ToolPart,
      ],
      { workspaceId: 'ws-123' },
    );
    expect(container.textContent).toContain('ws-123');
  });

  it('renders MessageSetAgentWorkspaceId for persisted tool part', () => {
    const { container } = renderRow(
      [
        {
          type: `tool-${SET_AGENT_WORKSPACE_ID_TOOL_NAME}`,
          toolCallId: 'call-ws-r',
          state: 'output-available',
          input: { workspaceId: 'ws-123' },
          output: { success: true },
        } as ToolPart,
      ],
      { workspaceId: 'ws-123' },
    );
    expect(container.textContent).toContain('ws-123');
  });
});
