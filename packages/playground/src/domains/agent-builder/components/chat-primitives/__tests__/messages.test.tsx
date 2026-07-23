import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent/message-list';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

type ToolPart = MastraMessagePart;

interface BuilderToolInput {
  toolName: string;
  toolCallId: string;
  input: Record<string, unknown>;
  output?: unknown;
}

const builderToolPart = (toolInput: BuilderToolInput): ToolPart =>
  ({
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      step: 0,
      toolCallId: toolInput.toolCallId,
      toolName: toolInput.toolName,
      args: toolInput.input,
      result: 'output' in toolInput ? toolInput.output : { success: true },
    },
  }) as unknown as ToolPart;

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

const BASE_URL = 'http://localhost:4111';

// Builder settings with no `picker` → `useBuilderPickerVisibility` resolves to
// unrestricted (all visible* null), matching the prior stubbed behavior.
const builderSettingsHandler = http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
  HttpResponse.json({ enabled: true }),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

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
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <FormProvider {...methods}>{children}</FormProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderMessage = (message: MastraDBMessage, defaultValues?: Partial<AgentBuilderEditFormValues>) =>
  render(
    <FormWrapper defaultValues={defaultValues}>
      <MessageRow message={message} />
    </FormWrapper>,
  );

const renderRow = (parts: ToolPart[], defaultValues?: Partial<AgentBuilderEditFormValues>) =>
  renderMessage(buildMessage(parts), defaultValues);

const buildMessage = (parts: ToolPart[]): MastraDBMessage =>
  ({
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts,
    },
  }) as unknown as MastraDBMessage;

describe('MessageRow dynamic-tool rendering', () => {
  beforeAll(() => {
    server.use(builderSettingsHandler);
  });

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

  it('renders persisted signal user text as a user message', () => {
    const prompt =
      'Build an agent that reviews TypeScript pull requests on GitHub. Look for type-safety issues, missing tests, and inconsistent patterns. Leave inline review comments with concrete suggestions.';

    const { container } = renderMessage({
      id: 'user-1780417120014-jvuzgio',
      role: 'signal',
      type: 'user',
      createdAt: new Date('2026-06-02T16:18:41.310Z'),
      threadId: 'agent-builder-rgyY_adhrsPtX7KSaaCsU',
      resourceId: 'builder-agent',
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: prompt,
            createdAt: 1780417121310,
          },
        ],
        metadata: {
          signal: {
            id: 'user-1780417120014-jvuzgio',
            type: 'user',
            tagName: 'user',
            createdAt: '2026-06-02T16:18:41.310Z',
            acceptedAt: '2026-06-02T16:18:41.295Z',
          },
        },
      },
    });

    expect(container.textContent).toContain(prompt);
    expect(container.querySelector('.justify-end')).not.toBeNull();
  });

  // An unrecognized signal type (not state/notification/reactive) produces no
  // SignalBadge, so its raw text is never shown.
  it('does not render unrecognized signal text messages', () => {
    const { container } = renderMessage({
      id: 'signal-1',
      role: 'signal',
      type: 'internal',
      createdAt: new Date('2026-06-02T16:18:41.310Z'),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'Internal signal' }],
      },
    });

    expect(container.textContent).not.toContain('Internal signal');
    // The row is dropped entirely rather than left as an empty assistant bubble.
    expect(container.textContent).toBe('');
  });

  // Regression: a persisted reactive signal must render as a SignalBadge on
  // read-back. This conversion existed at 1.41.0 and was lost when the renderer
  // was rewritten (PR #17774), which dropped the row entirely.
  it('renders a persisted reactive signal row as a signal badge on read-back', () => {
    const { container } = renderMessage({
      id: 'signal-reactive-1',
      role: 'signal',
      type: 'reactive',
      createdAt: new Date('2026-06-02T16:18:41.310Z'),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'reactive signal body' }],
        metadata: { signal: { type: 'reactive', tagName: 'system-reminder' } },
      },
    });

    expect(container.textContent).toContain('system-reminder');
    expect(container.textContent).toContain('reactive signal body');
  });

  it('renders user text through the shared MarkdownRenderer in a right-aligned bubble', () => {
    const { container } = renderMessage({
      id: 'user-md-1',
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'hello **world**' }],
      },
    } as unknown as MastraDBMessage);

    expect(container.querySelector('.justify-end')).not.toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe('world');
  });

  it('renders assistant text through the shared MarkdownRenderer', () => {
    const { container } = renderMessage(buildMessage([{ type: 'text', text: 'reply **bold**' } as ToolPart]));

    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('routes assistant text through the shared MessageText error-prefix handling', () => {
    const { container } = renderMessage(buildMessage([{ type: 'text', text: 'Error: it broke' } as ToolPart]));

    // The shared MessageText turns an `Error:`-prefixed body into a destructive notice.
    expect(container.textContent).toContain('it broke');
    expect(container.querySelector('[class*="destructive"]')).not.toBeNull();
  });

  it('renders a tripwire-status message through the shared TripwireNotice', () => {
    const { container } = renderMessage({
      id: 'assistant-tripwire-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'blocked for safety' }],
        metadata: { mode: 'stream', status: 'tripwire' },
      },
    } as unknown as MastraDBMessage);

    expect(container.textContent).toContain('Content Blocked');
    expect(container.textContent).toContain('blocked for safety');
  });

  it('renders a warning-status message through the shared warning notice', () => {
    const { container } = renderMessage({
      id: 'assistant-warning-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'heads up about this' }],
        metadata: { mode: 'stream', status: 'warning' },
      },
    } as unknown as MastraDBMessage);

    expect(container.textContent).toContain('Warning');
    expect(container.textContent).toContain('heads up about this');
  });

  it('renders the generic fallback for non-builder dynamic tools', () => {
    const { container, getByRole } = renderRow([
      builderToolPart({
        toolCallId: 'call-5',
        toolName: 'some-other-tool',
        input: { tools: [{ id: 'web-search', name: 'Web Search' }] },
        output: { success: true },
      }),
    ]);

    expect(container.textContent).toContain('Completed');
    expect(container.textContent).toContain('some-other-tool');
    expect(container.textContent).not.toContain('Web Search');

    fireEvent.click(getByRole('button'));

    expect(container.textContent).toContain('Input');
    expect(container.textContent).toContain('"web-search"');
    expect(container.textContent).toContain('Output');
    expect(container.textContent).toContain('"success": true');
  });

  it('omits the generic fallback output panel when there is no output', () => {
    const { container, getByRole } = renderRow([
      builderToolPart({
        toolCallId: 'call-5',
        toolName: 'some-other-tool',
        input: { a: 1 },
        output: undefined,
      }),
    ]);

    fireEvent.click(getByRole('button'));

    expect(container.textContent).toContain('Input');
    expect(container.textContent).not.toContain('Output');
  });

  it('renders signal data parts in agent-builder chat messages', () => {
    const { container } = renderRow([
      {
        type: 'data-signal',
        data: {
          type: 'notification',
          tagName: 'notification-summary',
          contents: [{ type: 'text', text: 'github: 2' }],
          attributes: { pending: 2, priority: 'high' },
        },
      } as ToolPart,
    ]);

    expect(container.textContent).toContain('Notification summary');
    expect(container.textContent).toContain('github: 2');
    expect(container.textContent).toContain('2 pending');
    expect(container.textContent).toContain('high');
  });

  it('renders MessageSetAgentName for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-name',
          toolName: SET_AGENT_NAME_TOOL_NAME,
          input: { name: 'Acme Bot' },
          output: { success: true },
        }),
      ],
      { name: 'Acme Bot' },
    );
    expect(container.textContent).toContain('Setting the agent name:');
    expect(container.textContent).toContain('Acme Bot');
  });

  it('renders MessageSetAgentName for persisted tool part', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-name-r',
          toolName: SET_AGENT_NAME_TOOL_NAME,
          input: { name: 'Acme Bot' },
          output: { success: true },
        }),
      ],
      { name: 'Acme Bot' },
    );
    expect(container.textContent).toContain('Setting the agent name:');
    expect(container.textContent).toContain('Acme Bot');
  });

  it('renders MessageSetAgentDescription for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-desc',
          toolName: SET_AGENT_DESCRIPTION_TOOL_NAME,
          input: { description: 'A helpful research assistant.' },
          output: { success: true },
        }),
      ],
      { description: 'A helpful research assistant.' },
    );
    expect(container.textContent).toContain('Setting the agent description:');
    expect(container.textContent).toContain('A helpful research assistant.');
  });

  it('renders MessageSetAgentDescription for persisted tool part', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-desc-r',
          toolName: SET_AGENT_DESCRIPTION_TOOL_NAME,
          input: { description: 'A helpful research assistant.' },
          output: { success: true },
        }),
      ],
      { description: 'A helpful research assistant.' },
    );
    expect(container.textContent).toContain('Setting the agent description:');
    expect(container.textContent).toContain('A helpful research assistant.');
  });

  it('renders MessageSetAgentInstructions for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-instr',
          toolName: SET_AGENT_INSTRUCTIONS_TOOL_NAME,
          input: { instructions: 'Always answer in French.' },
          output: { success: true },
        }),
      ],
      { instructions: 'Always answer in French.' },
    );
    expect(container.textContent).toContain('Setting the agent instructions:');
    expect(container.textContent).toContain('Always answer in French.');
  });

  it('renders MessageSetAgentInstructions for persisted tool part', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-instr-r',
          toolName: SET_AGENT_INSTRUCTIONS_TOOL_NAME,
          input: { instructions: 'Always answer in French.' },
          output: { success: true },
        }),
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
        builderToolPart({
          toolCallId: 'call-tools-mixed',
          toolName: SET_AGENT_TOOLS_TOOL_NAME,
          input: { tools: [] },
          output: { success: true },
        }),
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
        builderToolPart({
          toolCallId: 'call-tools-none',
          toolName: SET_AGENT_TOOLS_TOOL_NAME,
          input: { tools: [] },
          output: { success: true },
        }),
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
        builderToolPart({
          toolCallId: 'call-skills',
          toolName: SET_AGENT_SKILLS_TOOL_NAME,
          input: { skills: [] },
          output: { success: true },
        }),
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
        builderToolPart({
          toolCallId: 'call-skills-none',
          toolName: SET_AGENT_SKILLS_TOOL_NAME,
          input: { skills: [] },
          output: { success: true },
        }),
      ],
      { skills: {} } as Partial<AgentBuilderEditFormValues>,
    );

    expect(container.textContent).toContain('Enabling skills: none');
  });

  it('renders MessageSetAgentModel for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-model',
          toolName: SET_AGENT_MODEL_TOOL_NAME,
          input: { model: { provider: 'openai', name: 'gpt-4o' } },
          output: { success: true },
        }),
      ],
      { model: { provider: 'openai', name: 'gpt-4o' } },
    );
    expect(container.textContent).toContain('Setting agent model to');
    expect(container.textContent).toContain('openai/gpt-4o');
  });

  it('renders MessageSetAgentModel for persisted tool part', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-model-r',
          toolName: SET_AGENT_MODEL_TOOL_NAME,
          input: { model: { provider: 'openai', name: 'gpt-4o' } },
          output: { success: true },
        }),
      ],
      { model: { provider: 'openai', name: 'gpt-4o' } },
    );
    expect(container.textContent).toContain('Setting agent model to');
    expect(container.textContent).toContain('openai/gpt-4o');
  });

  it('renders MessageSetAgentBrowserEnabled (enabled) for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-browser',
          toolName: SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
          input: { browserEnabled: true },
          output: { success: true },
        }),
      ],
      { browserEnabled: true },
    );
    expect(container.textContent).toContain('Browser access');
    expect(container.textContent).toContain('enabled');
  });

  it('renders MessageSetAgentBrowserEnabled (disabled) for persisted tool part', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-browser-r',
          toolName: SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
          input: { browserEnabled: false },
          output: { success: true },
        }),
      ],
      { browserEnabled: false },
    );
    expect(container.textContent).toContain('Browser access');
    expect(container.textContent).toContain('disabled');
  });

  it('renders MessageSetAgentWorkspaceId for streaming dynamic-tool', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-ws',
          toolName: SET_AGENT_WORKSPACE_ID_TOOL_NAME,
          input: { workspaceId: 'ws-123' },
          output: { success: true },
        }),
      ],
      { workspaceId: 'ws-123' },
    );
    expect(container.textContent).toContain('ws-123');
  });

  it('renders MessageSetAgentWorkspaceId for persisted tool part', () => {
    const { container } = renderRow(
      [
        builderToolPart({
          toolCallId: 'call-ws-r',
          toolName: SET_AGENT_WORKSPACE_ID_TOOL_NAME,
          input: { workspaceId: 'ws-123' },
          output: { success: true },
        }),
      ],
      { workspaceId: 'ws-123' },
    );
    expect(container.textContent).toContain('ws-123');
  });
});
