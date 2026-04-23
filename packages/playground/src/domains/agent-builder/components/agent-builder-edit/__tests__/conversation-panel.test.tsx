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
) =>
  render(
    <FormWrapper>
      <ConversationPanel
        initialUserMessage="hello"
        features={features}
        availableTools={availableTools}
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
      tools: ['web-search'],
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

  it('constrains the tools field to the provided ids', () => {
    renderPanel({ ...allOff, tools: true }, [{ id: 'web-search' }]);
    const tool = getAgentBuilderTool();

    const valid = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      tools: ['web-search'],
    });
    expect(valid.success).toBe(true);

    const invalid = tool.inputSchema.safeParse({
      name: 'N',
      instructions: 'I',
      tools: ['unknown-tool'],
    });
    expect(invalid.success).toBe(false);
  });

  it('execute ignores tools and skills when feature flags are off', async () => {
    renderPanel(allOff);
    const tool = getAgentBuilderTool();

    await tool.execute({
      name: 'N',
      instructions: 'I',
      tools: ['web-search'],
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
        />
      </FormWrapper>,
    );

    expect(sentMessages).toHaveLength(1);
    const tool = sentMessages[0].clientTools.agentBuilderTool;
    expect(tool.description).toContain('web-search');
    expect(tool.description).toContain('Search the web');
  });

  it('sends the initial message once toolsReady is true on mount', () => {
    renderPanel({ ...allOff, tools: true }, [
      { id: 'web-search', description: 'Search the web' },
    ]);

    expect(sentMessages).toHaveLength(1);
    const tool = sentMessages[0].clientTools.agentBuilderTool;
    expect(tool.description).toContain('web-search');
  });
});
