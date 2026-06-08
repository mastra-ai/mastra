// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, cleanup } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentColorProvider } from '../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import {
  SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
  SET_AGENT_DESCRIPTION_TOOL_NAME,
  SET_AGENT_INSTRUCTIONS_TOOL_NAME,
  SET_AGENT_MODEL_TOOL_NAME,
  SET_AGENT_NAME_TOOL_NAME,
  SET_AGENT_SKILLS_TOOL_NAME,
  SET_AGENT_TOOLS_TOOL_NAME,
  SET_AGENT_WORKSPACE_ID_TOOL_NAME,
} from '../../../services/tool-constants';
import type { AgentTool } from '../../../types/agent-tool';
import { ConversationPanel } from '../conversation-panel';

type Features = {
  tools: boolean;
  memory: boolean;
  workflows: boolean;
  agents: boolean;
  avatarUpload: boolean;
  skills: boolean;
  model: boolean;
  favorites: boolean;
  browser: boolean;
};

const sentMessages: Array<{
  message: string;
  threadId?: string;
  clientTools: Record<string, any>;
  modelSettings?: { instructions?: string };
}> = [];
const agentMessagesCalls: Array<{ agentId: string; threadId: string; memory?: boolean }> = [];
const chatCalls: Array<{ agentId: string }> = [];
const chatState = { isRunning: false };

vi.mock('@mastra/react', () => ({
  useChat: (options: { agentId: string }) => {
    chatCalls.push(options);
    return {
      messages: [],
      isRunning: chatState.isRunning,
      setMessages: () => {},
      sendMessage: (payload: {
        message: string;
        threadId?: string;
        clientTools: Record<string, any>;
        modelSettings?: { instructions?: string };
      }) => {
        sentMessages.push(payload);
      },
    };
  },
  useMastraClient: () => ({}),
}));

vi.mock('@/hooks/use-agent-messages', () => ({
  useAgentMessages: (options: { agentId: string; threadId: string; memory?: boolean }) => {
    agentMessagesCalls.push(options);
    return { data: { messages: [] }, isLoading: false };
  },
}));

vi.mock('@/domains/agents/hooks/use-create-skill', () => ({
  useCreateSkill: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/domains/auth/hooks/use-default-visibility', () => ({
  useDefaultVisibility: () => 'private',
}));

const llmProviderState = { isLoading: false };

type MockProvider = { id: string; name: string; models: Array<{ id: string; name: string }> };
type MockModel = { provider: string; providerName: string; model: string };

const llmProvidersFixture: { value: MockProvider[] } = {
  value: [
    {
      id: 'openai',
      name: 'OpenAI',
      models: [{ id: 'gpt-4o', name: 'gpt-4o' }],
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      models: [{ id: 'claude-opus-4-7', name: 'claude-opus-4-7' }],
    },
  ],
};

const builderFilterRef: { fn: (models: MockModel[]) => MockModel[] } = {
  fn: models => models.filter(model => model.provider === 'openai'),
};

vi.mock('@/domains/agent-builder/hooks/use-agent-builder-allowed-models', () => ({
  useAgentBuilderAllowedModels: () => {
    const allModels: MockModel[] = llmProvidersFixture.value.flatMap(provider =>
      provider.models.map(model => ({ provider: provider.id, providerName: provider.name, model: model.name })),
    );
    return {
      providers: llmProvidersFixture.value,
      models: builderFilterRef.fn(allModels),
      isLoading: llmProviderState.isLoading,
    };
  },
}));

let formMethodsRef: UseFormReturn<AgentBuilderEditFormValues> | null = null;

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Initial',
      instructions: '',
      tools: {},
    },
  });
  formMethodsRef = methods;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter>
          <FormProvider {...methods}>
            <AgentColorProvider agentId="agent-test">{children}</AgentColorProvider>
          </FormProvider>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

const toAgentTools = (tools: Array<{ id: string; description?: string; type?: AgentTool['type'] }>): AgentTool[] =>
  tools.map(t => ({
    id: t.id,
    name: t.id,
    description: t.description,
    isChecked: false,
    type: t.type ?? 'tool',
  }));

const renderPanel = (
  features: Features,
  availableTools: Array<{ id: string; description?: string; type?: AgentTool['type'] }> = [],
  availableWorkspaces: Array<{ id: string; name: string }> = [],
) =>
  render(
    <FormWrapper>
      <ConversationPanel
        initialUserMessage="hello"
        features={features}
        availableAgentTools={toAgentTools(availableTools)}
        availableWorkspaces={availableWorkspaces}
        agentId="agent-test"
      />
    </FormWrapper>,
  );

const getSentClientTools = () => {
  expect(sentMessages.length).toBeGreaterThan(0);
  return sentMessages[0].clientTools;
};

const getTool = (toolName: string) => {
  const tool = getSentClientTools()[toolName];
  expect(tool).toBeDefined();
  return tool;
};

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
const allOn: Features = { ...allOff, tools: true };

describe('ConversationPanel agent-builder client tool', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    agentMessagesCalls.length = 0;
    chatCalls.length = 0;
    formMethodsRef = null;
    chatState.isRunning = false;
    llmProviderState.isLoading = false;
    llmProvidersFixture.value = [
      {
        id: 'openai',
        name: 'OpenAI',
        models: [{ id: 'gpt-4o', name: 'gpt-4o' }],
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: [{ id: 'claude-opus-4-7', name: 'claude-opus-4-7' }],
      },
    ];
    builderFilterRef.fn = models => models.filter(model => model.provider === 'openai');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the composer with the default border token styling', () => {
    const { getByTestId } = renderPanel(allOff);
    const composer = getByTestId('agent-builder-conversation-composer');
    expect(composer.className).toContain('border-border1');
    expect(composer.className).not.toContain('border-accent5Dark');
    expect(composer.className).not.toContain('focus-within:border-accent5');
  });

  it('loads and sends builder messages on a prefixed builder thread', () => {
    renderPanel(allOff);

    expect(agentMessagesCalls[0]).toMatchObject({
      agentId: 'builder-agent',
      threadId: 'agent-builder-agent-test',
      memory: true,
    });
    expect(chatCalls[0]).toMatchObject({ agentId: 'builder-agent' });
    expect(sentMessages[0]).toMatchObject({
      message: 'hello',
      threadId: 'agent-builder-agent-test',
    });
  });

  it('always registers the per-field name/description/instructions tools and omits gated ones', () => {
    renderPanel(allOff);
    const clientTools = getSentClientTools();

    expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_DESCRIPTION_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_INSTRUCTIONS_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_WORKSPACE_ID_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_TOOLS_TOOL_NAME]).toBeUndefined();
    expect(clientTools[SET_AGENT_SKILLS_TOOL_NAME]).toBeUndefined();
    expect(clientTools[SET_AGENT_MODEL_TOOL_NAME]).toBeUndefined();
    expect(clientTools[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeUndefined();
  });

  it('registers the set-agent-tools tool only when features.tools is true', () => {
    renderPanel(allOn);
    expect(getSentClientTools()[SET_AGENT_TOOLS_TOOL_NAME]).toBeDefined();
  });

  it('execute writes name and instructions to the form', async () => {
    renderPanel(allOff);

    await getTool(SET_AGENT_NAME_TOOL_NAME).execute({ name: 'New name' });
    await getTool(SET_AGENT_INSTRUCTIONS_TOOL_NAME).execute({ instructions: 'New instructions' });

    expect(formMethodsRef!.getValues('name')).toBe('New name');
    expect(formMethodsRef!.getValues('instructions')).toBe('New instructions');
  });

  it('execute writes tools only when the feature flag enables it', async () => {
    renderPanel(allOn, [{ id: 'web-search' }]);
    const tool = getTool(SET_AGENT_TOOLS_TOOL_NAME);

    await tool.execute({
      tools: [{ id: 'web-search', name: 'Web Search' }],
    });

    expect(formMethodsRef!.getValues('tools')).toEqual({ 'web-search': true });
  });

  it('lists available tools in the set-agent-tools description so the LLM can pick ids', () => {
    renderPanel({ ...allOff, tools: true }, [
      { id: 'web-search', description: 'Search the web' },
      { id: 'http-fetch', description: 'Fetch a URL' },
    ]);
    const tool = getTool(SET_AGENT_TOOLS_TOOL_NAME);

    expect(tool.description).toContain('web-search');
    expect(tool.description).toContain('Search the web');
    expect(tool.description).toContain('http-fetch');
    expect(tool.description).toContain('Fetch a URL');
  });

  it('requires both id and name for each entry in the tools field', () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search', description: 'Search the web' }]);
    const tool = getTool(SET_AGENT_TOOLS_TOOL_NAME);

    const valid = tool.inputSchema.safeParse({
      tools: [{ id: 'web-search', name: 'Web Search' }],
    });
    expect(valid.success).toBe(true);

    const missingName = tool.inputSchema.safeParse({
      tools: [{ id: 'web-search' }],
    });
    expect(missingName.success).toBe(false);

    const emptyName = tool.inputSchema.safeParse({
      tools: [{ id: 'web-search', name: '' }],
    });
    expect(emptyName.success).toBe(false);

    const asString = tool.inputSchema.safeParse({
      tools: ['web-search'],
    });
    expect(asString.success).toBe(false);
  });

  it('constrains the tools id field to the provided ids', () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search' }]);
    const tool = getTool(SET_AGENT_TOOLS_TOOL_NAME);

    const valid = tool.inputSchema.safeParse({
      tools: [{ id: 'web-search', name: 'Web Search' }],
    });
    expect(valid.success).toBe(true);

    const invalid = tool.inputSchema.safeParse({
      tools: [{ id: 'unknown-tool', name: 'Unknown' }],
    });
    expect(invalid.success).toBe(false);
  });

  it('omits the set-agent-tools tool entirely when features.tools is false', () => {
    renderPanel(allOff);
    expect(getSentClientTools()[SET_AGENT_TOOLS_TOOL_NAME]).toBeUndefined();
  });

  it('drops agent and workflow ids when those features are gated off but tools is on', async () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search', type: 'tool' }]);
    const tool = getTool(SET_AGENT_TOOLS_TOOL_NAME);

    await tool.execute({
      tools: [
        { id: 'web-search', name: 'Web Search' },
        { id: 'some-agent', name: 'Some Agent' },
        { id: 'some-workflow', name: 'Some Workflow' },
      ],
    });

    expect(formMethodsRef!.getValues('tools')).toEqual({ 'web-search': true });
    expect(formMethodsRef!.getValues('agents')).toEqual({});
    expect(formMethodsRef!.getValues('workflows')).toEqual({});
  });

  it('defers the initial send until toolsReady flips true', () => {
    const { rerender } = render(
      <FormWrapper>
        <ConversationPanel
          initialUserMessage="hello"
          features={{ ...allOff, tools: true }}
          availableAgentTools={[]}
          toolsReady={false}
          agentId="agent-test"
        />
      </FormWrapper>,
    );

    expect(sentMessages).toHaveLength(0);

    rerender(
      <FormWrapper>
        <ConversationPanel
          initialUserMessage="hello"
          features={{ ...allOff, tools: true }}
          availableAgentTools={toAgentTools([{ id: 'web-search', description: 'Search the web' }])}
          toolsReady={true}
          agentId="agent-test"
        />
      </FormWrapper>,
    );

    expect(sentMessages).toHaveLength(1);
    const tool = sentMessages[0].clientTools[SET_AGENT_TOOLS_TOOL_NAME];
    expect(tool.description).toContain('web-search');
    expect(tool.description).toContain('Search the web');
  });

  it('sends the initial message once toolsReady is true on mount', () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search', description: 'Search the web' }]);

    expect(sentMessages).toHaveLength(1);
    const tool = sentMessages[0].clientTools[SET_AGENT_TOOLS_TOOL_NAME];
    expect(tool.description).toContain('web-search');
  });

  it('exposes a workspaceId field in the set-agent-workspace-id schema', () => {
    renderPanel(allOff);
    const tool = getTool(SET_AGENT_WORKSPACE_ID_TOOL_NAME);
    const shape = tool.inputSchema.shape;

    expect(shape.workspaceId).toBeDefined();

    const withWorkspace = tool.inputSchema.safeParse({ workspaceId: 'any-id' });
    expect(withWorkspace.success).toBe(true);
  });

  it('lists available workspaces in the workspace tool description', () => {
    renderPanel(
      allOff,
      [],
      [
        { id: 'ws-1', name: 'Primary' },
        { id: 'ws-2', name: 'Secondary' },
      ],
    );
    const tool = getTool(SET_AGENT_WORKSPACE_ID_TOOL_NAME);

    expect(tool.description).toContain('ws-1');
    expect(tool.description).toContain('Primary');
    expect(tool.description).toContain('ws-2');
    expect(tool.description).toContain('Secondary');
  });

  it('constrains workspaceId to the provided ids when workspaces are available', () => {
    renderPanel(allOff, [], [{ id: 'ws-1', name: 'Primary' }]);
    const tool = getTool(SET_AGENT_WORKSPACE_ID_TOOL_NAME);

    const valid = tool.inputSchema.safeParse({
      workspaceId: 'ws-1',
    });
    expect(valid.success).toBe(true);

    const invalid = tool.inputSchema.safeParse({
      workspaceId: 'unknown-workspace',
    });
    expect(invalid.success).toBe(false);
  });

  it('passes policy-filtered models to the initial client tool schema and description', () => {
    renderPanel({ ...allOff, model: true });
    const tool = getTool(SET_AGENT_MODEL_TOOL_NAME);

    expect(tool.description).toContain('Available models');
    expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o');
    expect(tool.description).not.toContain('anthropic');

    expect(tool.inputSchema.shape.model).toBeDefined();
    expect(tool.inputSchema.safeParse({ model: { provider: 'openai', name: 'gpt-4o' } }).success).toBe(true);
    expect(
      tool.inputSchema.safeParse({
        model: { provider: 'anthropic', name: 'claude-opus-4-7' },
      }).success,
    ).toBe(false);
  });

  it('respects a combined provider-wildcard + specific-modelId policy across description and schema', () => {
    // Simulate the admin-configured allowlist:
    //   [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }]
    // Server returns all providers/models — the policy filter is what enforces the allowlist.
    llmProvidersFixture.value = [
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-4o', name: 'gpt-4o' },
          { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
        ],
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: [
          { id: 'claude-opus-4-7', name: 'claude-opus-4-7' },
          { id: 'claude-haiku-4-5', name: 'claude-haiku-4-5' },
        ],
      },
      {
        id: 'mistral',
        name: 'Mistral',
        models: [{ id: 'mistral-large', name: 'mistral-large' }],
      },
    ];
    builderFilterRef.fn = models =>
      models.filter(m => m.provider === 'openai' || (m.provider === 'anthropic' && m.model === 'claude-opus-4-7'));

    renderPanel({ ...allOff, model: true });
    const tool = getTool(SET_AGENT_MODEL_TOOL_NAME);

    // Both OpenAI models survive (provider wildcard).
    expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o');
    expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o-mini');
    // Only the explicit Anthropic model survives.
    expect(tool.description).toContain('provider: anthropic (Anthropic), name: claude-opus-4-7');
    expect(tool.description).not.toContain('claude-haiku-4-5');
    // Disallowed provider is dropped entirely.
    expect(tool.description).not.toContain('mistral');

    // Schema accepts every allowed combination.
    expect(tool.inputSchema.safeParse({ model: { provider: 'openai', name: 'gpt-4o' } }).success).toBe(true);
    expect(tool.inputSchema.safeParse({ model: { provider: 'openai', name: 'gpt-4o-mini' } }).success).toBe(true);
    expect(
      tool.inputSchema.safeParse({
        model: { provider: 'anthropic', name: 'claude-opus-4-7' },
      }).success,
    ).toBe(true);

    // Schema rejects disallowed entries.
    expect(
      tool.inputSchema.safeParse({
        model: { provider: 'anthropic', name: 'claude-haiku-4-5' },
      }).success,
    ).toBe(false);
    expect(
      tool.inputSchema.safeParse({
        model: { provider: 'mistral', name: 'mistral-large' },
      }).success,
    ).toBe(false);
  });

  it('execute writes workspaceId to the form when provided', async () => {
    renderPanel(allOff, [], [{ id: 'ws-1', name: 'Primary' }]);
    const tool = getTool(SET_AGENT_WORKSPACE_ID_TOOL_NAME);

    await tool.execute({ workspaceId: 'ws-1' });

    expect(formMethodsRef!.getValues('workspaceId')).toBe('ws-1');
  });

  it('execute does not set workspaceId when omitted', async () => {
    renderPanel(allOff, [], [{ id: 'ws-1', name: 'Primary' }]);
    const tool = getTool(SET_AGENT_WORKSPACE_ID_TOOL_NAME);

    await tool.execute({});

    expect(formMethodsRef!.getValues('workspaceId')).toBeUndefined();
  });

  it('does not include createSkillTool when features.skills is false', () => {
    renderPanel(allOff);
    const clientTools = getSentClientTools();

    expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
    expect(clientTools.createSkillTool).toBeUndefined();
  });

  it('includes createSkillTool when features.skills is true', () => {
    renderPanel({ ...allOff, skills: true }, [], [{ id: 'ws-1', name: 'Primary' }]);
    const clientTools = getSentClientTools();

    expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
    expect(clientTools.createSkillTool).toBeDefined();
    const createSkill = clientTools.createSkillTool;
    expect(createSkill.id).toBe('createSkillTool');
    expect(createSkill.inputSchema.shape.name).toBeDefined();
    expect(createSkill.inputSchema.shape.description).toBeDefined();
    expect(createSkill.inputSchema.shape.instructions).toBeDefined();
  });

  it('registers every atomic set-agent-* tool on the wire when all features are on with available data', () => {
    const allFeaturesOn: Features = {
      tools: true,
      memory: false,
      workflows: true,
      agents: true,
      avatarUpload: false,
      skills: true,
      model: true,
      favorites: false,
      browser: true,
    };
    renderPanel(allFeaturesOn, [{ id: 'web-search' }], [{ id: 'ws-1', name: 'Primary' }]);
    const clientTools = getSentClientTools();

    expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_DESCRIPTION_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_INSTRUCTIONS_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_TOOLS_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_MODEL_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeDefined();
    expect(clientTools[SET_AGENT_WORKSPACE_ID_TOOL_NAME]).toBeDefined();
    // createSkill is registered separately when features.skills is on.
    expect(clientTools.createSkillTool).toBeDefined();
  });

  it('omits set-agent-skills when features.skills is on but no skills are available', () => {
    renderPanel({ ...allOff, skills: true }, [], [{ id: 'ws-1', name: 'Primary' }]);
    const clientTools = getSentClientTools();

    expect(clientTools[SET_AGENT_SKILLS_TOOL_NAME]).toBeUndefined();
    expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
  });

  it('omits set-agent-model when features.model is on but no models survive the policy filter', () => {
    builderFilterRef.fn = () => [];
    renderPanel({ ...allOff, model: true });
    const clientTools = getSentClientTools();

    expect(clientTools[SET_AGENT_MODEL_TOOL_NAME]).toBeUndefined();
    expect(clientTools[SET_AGENT_NAME_TOOL_NAME]).toBeDefined();
  });

  it('omits set-agent-browser-enabled when features.browser is false', () => {
    renderPanel(allOff);
    const clientTools = getSentClientTools();

    expect(clientTools[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeUndefined();
  });

  it('registers set-agent-browser-enabled when features.browser is true', () => {
    renderPanel({ ...allOff, browser: true });
    const clientTools = getSentClientTools();

    expect(clientTools[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeDefined();
  });

  it('forwards a form-snapshot via modelSettings.instructions on send', () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search', description: 'Search the web' }]);

    expect(sentMessages.length).toBeGreaterThan(0);
    const instructions = sentMessages[0].modelSettings?.instructions;
    expect(typeof instructions).toBe('string');
    expect(instructions).toContain('Current agent configuration');
    expect(instructions).toContain('"Initial"');
    expect(instructions).toContain('Tools: (none selected)');
    // Snapshot lives only in modelSettings, not as a top-level instructions field.
    expect(sentMessages[0]).not.toHaveProperty('instructions');
  });
});

describe('ConversationPanel chat busy/done state', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    agentMessagesCalls.length = 0;
    chatCalls.length = 0;
    formMethodsRef = null;
    chatState.isRunning = false;
    llmProviderState.isLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the pending indicator and disables the composer while running', () => {
    chatState.isRunning = true;
    const { queryByTestId, getByTestId } = renderPanel(allOff);

    expect(queryByTestId('agent-builder-chat-pending')).not.toBeNull();
    const submit = getByTestId('agent-builder-conversation-submit');
    const input = getByTestId('agent-builder-conversation-input') as HTMLTextAreaElement;
    expect(submit.hasAttribute('disabled')).toBe(true);
    expect(submit.getAttribute('aria-label')).toBe('Generating…');
    expect(input.disabled).toBe(true);
  });

  it('hides the pending indicator and re-enables the composer when not running', () => {
    chatState.isRunning = false;
    llmProviderState.isLoading = false;
    const { queryByTestId, getByTestId } = renderPanel(allOff);

    expect(queryByTestId('agent-builder-chat-pending')).toBeNull();
    const submit = getByTestId('agent-builder-conversation-submit');
    const input = getByTestId('agent-builder-conversation-input') as HTMLTextAreaElement;
    expect(submit.getAttribute('aria-label')).toBe('Send');
    expect(input.disabled).toBe(false);
  });
});
