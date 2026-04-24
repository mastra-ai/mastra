// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { render, cleanup } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../../schemas';
import { ConversationPanel } from '../conversation-panel';

type Features = {
  tools: boolean;
  skills: boolean;
  memory: boolean;
  workflows: boolean;
  agents: boolean;
};

const sentMessages: Array<{ message: string; clientTools: Record<string, any> }> = [];

vi.mock('@mastra/react', () => ({
  useChat: () => ({
    messages: [],
    isRunning: false,
    setMessages: () => {},
    sendMessage: (payload: { message: string; clientTools: Record<string, any> }) => {
      sentMessages.push(payload);
    },
  }),
  useMastraClient: () => ({}),
}));

vi.mock('@/hooks/use-agent-messages', () => ({
  useAgentMessages: () => ({ data: { messages: [] }, isLoading: false }),
}));

let formMethodsRef: UseFormReturn<AgentBuilderEditFormValues> | null = null;

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: 'Initial',
      instructions: '',
      tools: {},
      skills: [],
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

const renderPanel = (
  features: Features,
  availableTools: Array<{ id: string; description?: string }> = [],
  availableWorkspaces: Array<{ id: string; name: string }> = [],
) =>
  render(
    <FormWrapper>
      <ConversationPanel
        initialUserMessage="hello"
        features={features}
        availableTools={availableTools}
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

const allOff: Features = { tools: false, skills: false, memory: false, workflows: false, agents: false };
const allOn: Features = { tools: true, skills: true, memory: false, workflows: false, agents: false };

describe('ConversationPanel agent-builder client tool', () => {
  beforeEach(() => {
    sentMessages.length = 0;
    formMethodsRef = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('always exposes name and instructions as required fields when both feature flags are off', () => {
    renderPanel(allOff);
    const tool = getAgentBuilderTool();
    const shape = tool.inputSchema.shape;

    expect(shape.name).toBeDefined();
    expect(shape.instructions).toBeDefined();
    expect(shape.tools).toBeUndefined();
    expect(shape.skills).toBeUndefined();

    const valid = tool.inputSchema.safeParse({ name: 'Foo', instructions: 'Do X' });
    expect(valid.success).toBe(true);
    const missing = tool.inputSchema.safeParse({ name: 'Foo' });
    expect(missing.success).toBe(false);
  });

  it('adds tools and skills to the schema when both feature flags are on', () => {
    renderPanel(allOn);
    const tool = getAgentBuilderTool();
    const shape = tool.inputSchema.shape;

    expect(shape.name).toBeDefined();
    expect(shape.instructions).toBeDefined();
    expect(shape.tools).toBeDefined();
    expect(shape.skills).toBeDefined();
  });

  it('only includes tools when features.tools is true', () => {
    renderPanel({ ...allOff, tools: true });
    const tool = getAgentBuilderTool();
    const shape = tool.inputSchema.shape;

    expect(shape.tools).toBeDefined();
    expect(shape.skills).toBeUndefined();
  });

  it('execute writes name and instructions to the form', async () => {
    renderPanel(allOff);
    const tool = getAgentBuilderTool();

    await tool.execute({ name: 'New name', instructions: 'New instructions' });

    expect(formMethodsRef!.getValues('name')).toBe('New name');
    expect(formMethodsRef!.getValues('instructions')).toBe('New instructions');
  });

  it('execute writes tools and skills only when feature flags enable them', async () => {
    renderPanel(allOn);
    const tool = getAgentBuilderTool();

    await tool.execute({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'web-search', name: 'Web Search' }],
      skills: ['summarize'],
    });

    expect(formMethodsRef!.getValues('tools')).toEqual({ 'web-search': true });
    expect(formMethodsRef!.getValues('skills')).toEqual(['summarize']);
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

  it('execute ignores tools and skills when feature flags are off', async () => {
    renderPanel(allOff);
    const tool = getAgentBuilderTool();

    await tool.execute({
      name: 'N',
      instructions: 'I',
      tools: [{ id: 'web-search', name: 'Web Search' }],
      skills: ['summarize'],
    });

    expect(formMethodsRef!.getValues('tools')).toEqual({});
    expect(formMethodsRef!.getValues('skills')).toEqual([]);
  });

  it('defers the initial send until toolsReady flips true', () => {
    const { rerender } = render(
      <FormWrapper>
        <ConversationPanel
          initialUserMessage="hello"
          features={{ ...allOff, tools: true }}
          availableTools={[]}
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
          availableTools={[{ id: 'web-search', description: 'Search the web' }]}
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
});
