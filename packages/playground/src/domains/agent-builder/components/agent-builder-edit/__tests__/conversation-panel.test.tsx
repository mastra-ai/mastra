// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, cleanup } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../../schemas';
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
  stars: boolean;
};

const sentMessages: Array<{ message: string; threadId?: string; clientTools: Record<string, any> }> = [];
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
      sendMessage: (payload: { message: string; threadId?: string; clientTools: Record<string, any> }) => {
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

vi.mock('@/domains/llm', () => ({
  useLLMProviders: () => ({
    data: {
      providers: llmProvidersFixture.value,
    },
    isLoading: llmProviderState.isLoading,
  }),
  useAllModels: (providers: MockProvider[]) =>
    providers.flatMap(provider =>
      provider.models.map(model => ({ provider: provider.id, providerName: provider.name, model: model.name })),
    ),
  cleanProviderId: (provider: string) => provider.replace(/^gateway\//, ''),
}));

vi.mock('@/domains/builder', () => ({
  useBuilderModelPolicy: () => ({ active: true }),
  useBuilderFilteredModels: (models: MockModel[]) => builderFilterRef.fn(models),
}));

let formMethodsRef: UseFormReturn<AgentBuilderEditFormValues> | null = null;

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Initial',
      instructions: '',
      tools: {},
    },
  });
  formMethodsRef = methods;
  return (
    <TooltipProvider>
      <MemoryRouter>
        <FormProvider {...methods}>{children}</FormProvider>
      </MemoryRouter>
    </TooltipProvider>
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

const getAgentBuilderTool = () => {
  expect(sentMessages.length).toBeGreaterThan(0);
  const tool = sentMessages[0].clientTools.agentBuilderTool;
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
  stars: false,
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

  it('renders the composer with info border token styling', () => {
    const { getByTestId } = renderPanel(allOff);
    const composer = getByTestId('agent-builder-conversation-composer');
    expect(composer.className).toContain('border-accent5Dark');
    expect(composer.className).toContain('focus-within:border-accent5');
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

  it('always exposes name and instructions as required fields when both feature flags are off', () => {
    renderPanel(allOff);
    const tool = getAgentBuilderTool();
    const shape = tool.inputSchema.shape;

    expect(shape.name).toBeDefined();
    expect(shape.instructions).toBeDefined();
    expect(shape.tools).toBeUndefined();

    const valid = tool.inputSchema.safeParse({ name: 'Foo', instructions: 'Do X' });
    expect(valid.success).toBe(true);
    const missing = tool.inputSchema.safeParse({ name: 'Foo' });
    expect(missing.success).toBe(false);
  });

  it('adds tools to the schema when the feature flag is on', () => {
    renderPanel(allOn);
    const tool = getAgentBuilderTool();
    const shape = tool.inputSchema.shape;

    expect(shape.name).toBeDefined();
    expect(shape.instructions).toBeDefined();
    expect(shape.tools).toBeDefined();
  });

  it('only includes tools when features.tools is true', () => {
    renderPanel({ ...allOff, tools: true });
    const tool = getAgentBuilderTool();
    const shape = tool.inputSchema.shape;

    expect(shape.tools).toBeDefined();
  });

  it('execute writes name and instructions to the form', async () => {
    renderPanel(allOff);
    const tool = getAgentBuilderTool();

    await tool.execute({ name: 'New name', instructions: 'New instructions' });

    expect(formMethodsRef!.getValues('name')).toBe('New name');
    expect(formMethodsRef!.getValues('instructions')).toBe('New instructions');
  });

  it('execute writes tools only when the feature flag enables it', async () => {
    renderPanel(allOn, [{ id: 'web-search' }]);
    const tool = getAgentBuilderTool();

    await tool.execute({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'web-search', name: 'Web Search' }],
    });

    expect(formMethodsRef!.getValues('tools')).toEqual({ 'web-search': true });
  });

  it('lists available tools in the tool description so the LLM can pick ids', () => {
    renderPanel({ ...allOff, tools: true }, [
      { id: 'web-search', description: 'Search the web' },
      { id: 'http-fetch', description: 'Fetch a URL' },
    ]);
    const tool = getAgentBuilderTool();

    expect(tool.description).toContain('web-search');
    expect(tool.description).toContain('Search the web');
    expect(tool.description).toContain('http-fetch');
    expect(tool.description).toContain('Fetch a URL');
  });

  it('requires both id and name for each entry in the tools field', () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search', description: 'Search the web' }]);
    const tool = getAgentBuilderTool();

    const valid = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'web-search', name: 'Web Search' }],
    });
    expect(valid.success).toBe(true);

    const missingName = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'web-search' }],
    });
    expect(missingName.success).toBe(false);

    const emptyName = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'web-search', name: '' }],
    });
    expect(emptyName.success).toBe(false);

    const asString = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      tools: ['web-search'],
    });
    expect(asString.success).toBe(false);
  });

  it('constrains the tools id field to the provided ids', () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search' }]);
    const tool = getAgentBuilderTool();

    const valid = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'web-search', name: 'Web Search' }],
    });
    expect(valid.success).toBe(true);

    const invalid = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'unknown-tool', name: 'Unknown' }],
    });
    expect(invalid.success).toBe(false);
  });

  it('execute ignores tools when the feature flag is off', async () => {
    renderPanel(allOff);
    const tool = getAgentBuilderTool();

    await tool.execute({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'web-search', name: 'Web Search' }],
    });

    expect(formMethodsRef!.getValues('tools')).toEqual({});
  });

  it('drops agent and workflow ids when those features are gated off but tools is on', async () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search', type: 'tool' }]);
    const tool = getAgentBuilderTool();

    await tool.execute({
      name: 'N',
      instructions: 'I',
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
    const tool = sentMessages[0].clientTools.agentBuilderTool;
    expect(tool.description).toContain('web-search');
    expect(tool.description).toContain('Search the web');
  });

  it('sends the initial message once toolsReady is true on mount', () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search', description: 'Search the web' }]);

    expect(sentMessages).toHaveLength(1);
    const tool = sentMessages[0].clientTools.agentBuilderTool;
    expect(tool.description).toContain('web-search');
  });

  it('exposes an optional workspaceId field in the tool input schema', () => {
    renderPanel(allOff);
    const tool = getAgentBuilderTool();
    const shape = tool.inputSchema.shape;

    expect(shape.workspaceId).toBeDefined();

    const withoutWorkspace = tool.inputSchema.safeParse({ name: 'N', instructions: 'I' });
    expect(withoutWorkspace.success).toBe(true);
  });

  it('lists available workspaces in the tool description', () => {
    renderPanel(
      allOff,
      [],
      [
        { id: 'ws-1', name: 'Primary' },
        { id: 'ws-2', name: 'Secondary' },
      ],
    );
    const tool = getAgentBuilderTool();

    expect(tool.description).toContain('ws-1');
    expect(tool.description).toContain('Primary');
    expect(tool.description).toContain('ws-2');
    expect(tool.description).toContain('Secondary');
  });

  it('constrains workspaceId to the provided ids when workspaces are available', () => {
    renderPanel(allOff, [], [{ id: 'ws-1', name: 'Primary' }]);
    const tool = getAgentBuilderTool();

    const valid = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      workspaceId: 'ws-1',
    });
    expect(valid.success).toBe(true);

    const invalid = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      workspaceId: 'unknown-workspace',
    });
    expect(invalid.success).toBe(false);
  });

  it('passes policy-filtered models to the initial client tool schema and description', () => {
    renderPanel({ ...allOff, model: true });
    const tool = getAgentBuilderTool();

    expect(tool.description).toContain('Available models');
    expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o');
    expect(tool.description).not.toContain('anthropic');

    expect(tool.inputSchema.shape.model).toBeDefined();
    expect(
      tool.inputSchema.safeParse({ name: 'N', instructions: 'I', model: { provider: 'openai', name: 'gpt-4o' } })
        .success,
    ).toBe(true);
    expect(
      tool.inputSchema.safeParse({
        name: 'N',
        instructions: 'I',
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
    const tool = getAgentBuilderTool();

    // Both OpenAI models survive (provider wildcard).
    expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o');
    expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o-mini');
    // Only the explicit Anthropic model survives.
    expect(tool.description).toContain('provider: anthropic (Anthropic), name: claude-opus-4-7');
    expect(tool.description).not.toContain('claude-haiku-4-5');
    // Disallowed provider is dropped entirely.
    expect(tool.description).not.toContain('mistral');

    // Schema accepts every allowed combination.
    expect(
      tool.inputSchema.safeParse({ name: 'N', instructions: 'I', model: { provider: 'openai', name: 'gpt-4o' } })
        .success,
    ).toBe(true);
    expect(
      tool.inputSchema.safeParse({ name: 'N', instructions: 'I', model: { provider: 'openai', name: 'gpt-4o-mini' } })
        .success,
    ).toBe(true);
    expect(
      tool.inputSchema.safeParse({
        name: 'N',
        instructions: 'I',
        model: { provider: 'anthropic', name: 'claude-opus-4-7' },
      }).success,
    ).toBe(true);

    // Schema rejects disallowed entries.
    expect(
      tool.inputSchema.safeParse({
        name: 'N',
        instructions: 'I',
        model: { provider: 'anthropic', name: 'claude-haiku-4-5' },
      }).success,
    ).toBe(false);
    expect(
      tool.inputSchema.safeParse({
        name: 'N',
        instructions: 'I',
        model: { provider: 'mistral', name: 'mistral-large' },
      }).success,
    ).toBe(false);
  });

  it('execute writes workspaceId to the form when provided', async () => {
    renderPanel(allOff, [], [{ id: 'ws-1', name: 'Primary' }]);
    const tool = getAgentBuilderTool();

    await tool.execute({ name: 'N', instructions: 'I', workspaceId: 'ws-1' });

    expect(formMethodsRef!.getValues('workspaceId')).toBe('ws-1');
  });

  it('execute does not set workspaceId when omitted', async () => {
    renderPanel(allOff, [], [{ id: 'ws-1', name: 'Primary' }]);
    const tool = getAgentBuilderTool();

    await tool.execute({ name: 'N', instructions: 'I' });

    expect(formMethodsRef!.getValues('workspaceId')).toBeUndefined();
  });

  it('does not include createSkillTool when features.skills is false', () => {
    renderPanel(allOff);
    expect(sentMessages.length).toBeGreaterThan(0);
    const clientTools = sentMessages[0].clientTools;

    expect(clientTools.agentBuilderTool).toBeDefined();
    expect(clientTools.createSkillTool).toBeUndefined();
  });

  it('includes createSkillTool when features.skills is true', () => {
    renderPanel({ ...allOff, skills: true }, [], [{ id: 'ws-1', name: 'Primary' }]);
    expect(sentMessages.length).toBeGreaterThan(0);
    const clientTools = sentMessages[0].clientTools;

    expect(clientTools.agentBuilderTool).toBeDefined();
    expect(clientTools.createSkillTool).toBeDefined();
    const createSkill = clientTools.createSkillTool;
    expect(createSkill.id).toBe('createSkillTool');
    expect(createSkill.inputSchema.shape.name).toBeDefined();
    expect(createSkill.inputSchema.shape.description).toBeDefined();
    expect(createSkill.inputSchema.shape.instructions).toBeDefined();
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
