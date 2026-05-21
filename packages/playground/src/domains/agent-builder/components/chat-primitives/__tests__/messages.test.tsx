// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import type { MastraUIMessage } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';

import { CONNECT_CHANNEL_TOOL_NAME } from '../../../hooks/use-connect-channel-tool';
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
import { server } from '@/test/msw-server';

type ToolPart = MastraUIMessage['parts'][number];

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

const ChannelsWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl="http://localhost:4111">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const buildMessage = (parts: MastraUIMessage['parts']): MastraUIMessage => ({
  id: 'msg-1',
  role: 'assistant',
  parts,
});

describe('MessageRow dynamic-tool rendering', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the generic shimmer for non-builder dynamic tools', () => {
    const { container } = render(
      <MessageRow
        message={buildMessage([
          {
            type: 'dynamic-tool',
            toolCallId: 'call-5',
            toolName: 'some-other-tool',
            state: 'output-available',
            input: { tools: [{ id: 'web-search', name: 'Web Search' }] },
            output: { success: true },
          } as MastraUIMessage['parts'][number],
        ])}
      />,
    );

    // Unknown dynamic tools render as a GenericTool ToolCard showing "Executing <toolName>".
    expect(container.textContent).toContain('Executing');
    expect(container.textContent).toContain('some-other-tool');
    expect(container.textContent).not.toContain('Web Search');
  });

  it('renders the inline Slack connect widget for the connectChannel tool', async () => {
    server.use(
      http.get('*/api/channels/platforms', () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      ),
      http.get('*/api/channels/:platform/installations', () => HttpResponse.json([])),
    );

    render(
      <ChannelsWrapper>
        <MessageRow
          agentId="agent-1"
          message={buildMessage([
            {
              type: 'dynamic-tool',
              toolCallId: 'call-2',
              toolName: CONNECT_CHANNEL_TOOL_NAME,
              state: 'output-available',
              input: { platform: 'slack' },
              output: { success: true },
            } as MastraUIMessage['parts'][number],
          ])}
        />
      </ChannelsWrapper>,
    );

    const widget = await screen.findByTestId('agent-builder-chat-connect-channel-slack');
    expect(widget.textContent).toContain('Slack');
    // Generic ToolExecutionMessage shimmer would end with "..." — confirm we don't fall through.
    await waitFor(() => {
      expect(widget.textContent?.endsWith('...')).toBe(false);
    });
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

  it('renders MessageSetAgentTools for streaming dynamic-tool', () => {
    const { container } = renderRow([
      {
        type: 'dynamic-tool',
        toolCallId: 'call-tools',
        toolName: SET_AGENT_TOOLS_TOOL_NAME,
        state: 'output-available',
        input: {
          tools: [
            { id: 'web-search', name: 'Web Search' },
            { id: 'weather-lookup', name: 'Weather Lookup' },
          ],
        },
        output: { success: true },
      } as ToolPart,
    ]);
    expect(container.textContent).toContain('Web Search');
    expect(container.textContent).toContain('Weather Lookup');
  });

  it('renders MessageSetAgentTools for persisted tool part', () => {
    const { container } = renderRow([
      {
        type: `tool-${SET_AGENT_TOOLS_TOOL_NAME}`,
        toolCallId: 'call-tools-r',
        state: 'output-available',
        input: {
          tools: [
            { id: 'web-search', name: 'Web Search' },
            { id: 'weather-lookup', name: 'Weather Lookup' },
          ],
        },
        output: { success: true },
      } as ToolPart,
    ]);
    expect(container.textContent).toContain('Web Search');
    expect(container.textContent).toContain('Weather Lookup');
  });

  it('MessageSetAgentTools reflects entries enabled under agents/workflows form fields', () => {
    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-tools-agent',
          toolName: SET_AGENT_TOOLS_TOOL_NAME,
          state: 'output-available',
          input: {
            tools: [
              { id: 'my-agent', name: 'My Agent' },
              { id: 'my-workflow', name: 'My Workflow' },
            ],
          },
          output: { success: true },
        } as ToolPart,
      ],
      {
        tools: {},
        agents: { 'my-agent': true },
        workflows: { 'my-workflow': true },
      } as Partial<AgentBuilderEditFormValues>,
    );
    expect(container.textContent).toContain('Enabling tools: My Agent, My Workflow');
  });

  it('MessageSetAgentTools renders "none" when no streamed ids are enabled in form', () => {
    const { container } = renderRow(
      [
        {
          type: 'dynamic-tool',
          toolCallId: 'call-tools-none',
          toolName: SET_AGENT_TOOLS_TOOL_NAME,
          state: 'output-available',
          input: {
            tools: [{ id: 'web-search', name: 'Web Search' }],
          },
          output: { success: true },
        } as ToolPart,
      ],
      { tools: {}, agents: {}, workflows: {} } as Partial<AgentBuilderEditFormValues>,
    );
    expect(container.textContent).toContain('Enabling tools: none');
  });

  it('renders MessageSetAgentSkills for streaming dynamic-tool', () => {
    const { container } = renderRow([
      {
        type: 'dynamic-tool',
        toolCallId: 'call-skills',
        toolName: SET_AGENT_SKILLS_TOOL_NAME,
        state: 'output-available',
        input: {
          skills: [
            { id: 'sk-1', name: 'Summarize' },
            { id: 'sk-2', name: 'Translate' },
          ],
        },
        output: { success: true },
      } as ToolPart,
    ]);
    expect(container.textContent).toContain('Summarize');
    expect(container.textContent).toContain('Translate');
  });

  it('renders MessageSetAgentSkills for persisted tool part', () => {
    const { container } = renderRow([
      {
        type: `tool-${SET_AGENT_SKILLS_TOOL_NAME}`,
        toolCallId: 'call-skills-r',
        state: 'output-available',
        input: {
          skills: [
            { id: 'sk-1', name: 'Summarize' },
            { id: 'sk-2', name: 'Translate' },
          ],
        },
        output: { success: true },
      } as ToolPart,
    ]);
    expect(container.textContent).toContain('Summarize');
    expect(container.textContent).toContain('Translate');
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
    const { container } = renderRow([
      {
        type: 'dynamic-tool',
        toolCallId: 'call-ws',
        toolName: SET_AGENT_WORKSPACE_ID_TOOL_NAME,
        state: 'output-available',
        input: { workspaceId: 'ws-123' },
        output: { success: true },
      } as ToolPart,
    ]);
    expect(container.textContent).toContain('ws-123');
  });

  it('renders MessageSetAgentWorkspaceId for persisted tool part', () => {
    const { container } = renderRow([
      {
        type: `tool-${SET_AGENT_WORKSPACE_ID_TOOL_NAME}`,
        toolCallId: 'call-ws-r',
        state: 'output-available',
        input: { workspaceId: 'ws-123' },
        output: { success: true },
      } as ToolPart,
    ]);
    expect(container.textContent).toContain('ws-123');
  });

  it('renders the inline Slack connect widget for persisted connectChannel tool parts (post-reload shape)', async () => {
    server.use(
      http.get('*/api/channels/platforms', () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      ),
      http.get('*/api/channels/:platform/installations', () => HttpResponse.json([])),
    );

    render(
      <ChannelsWrapper>
        <MessageRow
          agentId="agent-1"
          message={buildMessage([
            {
              type: `tool-${CONNECT_CHANNEL_TOOL_NAME}`,
              toolCallId: 'call-4',
              state: 'output-available',
              input: { platform: 'slack' },
              output: { success: true },
            } as MastraUIMessage['parts'][number],
          ])}
        />
      </ChannelsWrapper>,
    );

    const widget = await screen.findByTestId('agent-builder-chat-connect-channel-slack');
    expect(widget.textContent).toContain('Slack');
    await waitFor(() => {
      expect(widget.textContent?.endsWith('...')).toBe(false);
    });
  });
});
