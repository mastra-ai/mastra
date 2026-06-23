// @vitest-environment jsdom
import type { StoredSkillResponse } from '@mastra/client-js';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod-v4';

import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { useAgentBuilderTool } from '../use-agent-builder-tool';
import type { AvailableWorkspace } from '../use-agent-builder-tool';
import { SET_AGENT_BROWSER_ENABLED_TOOL_NAME } from '../use-set-agent-browser-enabled-tool';
import { SET_AGENT_DESCRIPTION_TOOL_NAME } from '../use-set-agent-description-tool';
import { SET_AGENT_INSTRUCTIONS_TOOL_NAME } from '../use-set-agent-instructions-tool';
import { SET_AGENT_MODEL_TOOL_NAME } from '../use-set-agent-model-tool';
import { SET_AGENT_NAME_TOOL_NAME } from '../use-set-agent-name-tool';
import { SET_AGENT_SKILLS_TOOL_NAME } from '../use-set-agent-skills-tool';
import { SET_AGENT_TOOLS_TOOL_NAME } from '../use-set-agent-tools-tool';
import { SET_AGENT_WORKSPACE_ID_TOOL_NAME } from '../use-set-agent-workspace-id-tool';
import type { ModelInfo } from '@/domains/llm';

const allOnFeatures = {
  tools: true,
  memory: false,
  workflows: false,
  agents: true,
  avatarUpload: false,
  skills: true,
  model: true,
  favorites: false,
  browser: true,
};

const allOffFeatures = {
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

const buildSkill = (id: string): StoredSkillResponse =>
  ({
    id,
    status: 'published',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    name: id,
    instructions: 'inst',
  }) as StoredSkillResponse;

const toAgentTools = (tools: Array<{ id: string; description?: string; type?: AgentTool['type'] }>): AgentTool[] =>
  tools.map(t => ({
    id: t.id,
    name: t.id,
    description: t.description,
    isChecked: false,
    type: t.type ?? 'tool',
  }));

interface RenderArgs {
  features: typeof allOnFeatures;
  availableAgentTools?: AgentTool[];
  availableWorkspaces?: AvailableWorkspace[];
  availableSkills?: StoredSkillResponse[];
  availableModels?: ModelInfo[];
}

const renderTools = (args: RenderArgs) => {
  const formRef: { current: UseFormReturn<AgentBuilderEditFormValues> | null } = { current: null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '', tools: {} },
    });
    formRef.current = methods;
    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  const { result } = renderHook(
    () =>
      useAgentBuilderTool({
        features: args.features,
        availableAgentTools: args.availableAgentTools ?? [],
        availableWorkspaces: args.availableWorkspaces,
        availableSkills: args.availableSkills,
        availableModels: args.availableModels,
      }),
    { wrapper: Wrapper },
  );

  return { record: result.current, form: () => formRef.current! };
};

type ToolRecord = ReturnType<typeof useAgentBuilderTool>;

const toolOf = (record: ToolRecord, name: string) => {
  const tool = record[name];
  expect(tool).toBeDefined();
  return tool;
};

const toolSchema = (record: ToolRecord, name: string) => {
  const schema = toolOf(record, name).inputSchema;
  expect(schema).toBeDefined();
  return schema as z.ZodType;
};

const toolShape = (record: ToolRecord, name: string) => (toolSchema(record, name) as z.ZodObject<z.ZodRawShape>).shape;

describe('useAgentBuilderTool', () => {
  describe('when every feature is on and all lists are populated', () => {
    it('returns all eight atomic tools', () => {
      const { record } = renderTools({
        features: allOnFeatures,
        availableAgentTools: toAgentTools([{ id: 'tool-a' }]),
        availableSkills: [buildSkill('skill-a')],
        availableModels: [{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }],
      });

      expect(Object.keys(record).sort()).toEqual(
        [
          SET_AGENT_NAME_TOOL_NAME,
          SET_AGENT_DESCRIPTION_TOOL_NAME,
          SET_AGENT_INSTRUCTIONS_TOOL_NAME,
          SET_AGENT_WORKSPACE_ID_TOOL_NAME,
          SET_AGENT_TOOLS_TOOL_NAME,
          SET_AGENT_SKILLS_TOOL_NAME,
          SET_AGENT_MODEL_TOOL_NAME,
          SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
        ].sort(),
      );
    });

    it('ids each tool with its own tool name', () => {
      const { record } = renderTools({
        features: allOnFeatures,
        availableAgentTools: toAgentTools([{ id: 'tool-a' }]),
        availableSkills: [buildSkill('skill-a')],
        availableModels: [{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }],
      });

      expect(record[SET_AGENT_NAME_TOOL_NAME].id).toBe(SET_AGENT_NAME_TOOL_NAME);
      expect(record[SET_AGENT_TOOLS_TOOL_NAME].id).toBe(SET_AGENT_TOOLS_TOOL_NAME);
      expect(record[SET_AGENT_MODEL_TOOL_NAME].id).toBe(SET_AGENT_MODEL_TOOL_NAME);
    });
  });

  describe('when every feature is off', () => {
    it('returns only the always-on name/description/instructions/workspace tools', () => {
      const { record } = renderTools({ features: allOffFeatures });

      expect(Object.keys(record).sort()).toEqual(
        [
          SET_AGENT_NAME_TOOL_NAME,
          SET_AGENT_DESCRIPTION_TOOL_NAME,
          SET_AGENT_INSTRUCTIONS_TOOL_NAME,
          SET_AGENT_WORKSPACE_ID_TOOL_NAME,
        ].sort(),
      );
    });
  });

  describe('when features.tools toggles', () => {
    it('omits the set-agent-tools tool when tools is false', () => {
      const { record } = renderTools({ features: { ...allOnFeatures, tools: false } });
      expect(record[SET_AGENT_TOOLS_TOOL_NAME]).toBeUndefined();
    });

    it('includes the set-agent-tools tool when tools is true', () => {
      const { record } = renderTools({ features: { ...allOnFeatures, tools: true } });
      expect(record[SET_AGENT_TOOLS_TOOL_NAME]).toBeDefined();
    });
  });

  describe('when features.skills is on', () => {
    it('omits the skills tool when no skills are available', () => {
      const { record } = renderTools({ features: { ...allOnFeatures, skills: true }, availableSkills: [] });
      expect(record[SET_AGENT_SKILLS_TOOL_NAME]).toBeUndefined();
    });

    it('includes the skills tool when skills are available', () => {
      const { record } = renderTools({
        features: { ...allOnFeatures, skills: true },
        availableSkills: [buildSkill('skill-a')],
      });
      expect(record[SET_AGENT_SKILLS_TOOL_NAME]).toBeDefined();
    });
  });

  describe('when features.model is on', () => {
    it('omits the model tool when no models are available', () => {
      const { record } = renderTools({ features: { ...allOnFeatures, model: true }, availableModels: [] });
      expect(record[SET_AGENT_MODEL_TOOL_NAME]).toBeUndefined();
    });

    it('includes the model tool when models are available', () => {
      const { record } = renderTools({
        features: { ...allOnFeatures, model: true },
        availableModels: [{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }],
      });
      expect(record[SET_AGENT_MODEL_TOOL_NAME]).toBeDefined();
    });
  });

  describe('when features.browser toggles', () => {
    it('omits the browserEnabled tool when browser is false', () => {
      const { record } = renderTools({ features: { ...allOnFeatures, browser: false } });
      expect(record[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeUndefined();
    });

    it('includes the browserEnabled tool when browser is true', () => {
      const { record } = renderTools({ features: { ...allOffFeatures, browser: true } });
      expect(record[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeDefined();
    });
  });

  describe('set-agent-name / set-agent-instructions tools', () => {
    it('write name and instructions to the form on execute', async () => {
      const { record, form } = renderTools({ features: allOffFeatures });

      await toolOf(record, SET_AGENT_NAME_TOOL_NAME).execute!({ name: 'New name' } as never, {} as never);
      await toolOf(record, SET_AGENT_INSTRUCTIONS_TOOL_NAME).execute!(
        { instructions: 'New instructions' } as never,
        {} as never,
      );

      expect(form().getValues('name')).toBe('New name');
      expect(form().getValues('instructions')).toBe('New instructions');
    });
  });

  describe('set-agent-tools tool', () => {
    it('writes selected tools to the form on execute', async () => {
      const { record, form } = renderTools({
        features: { ...allOffFeatures, tools: true },
        availableAgentTools: toAgentTools([{ id: 'web-search' }]),
      });

      await toolOf(record, SET_AGENT_TOOLS_TOOL_NAME).execute!(
        { tools: [{ id: 'web-search', name: 'Web Search' }] } as never,
        {} as never,
      );

      expect(form().getValues('tools')).toEqual({ 'web-search': true });
    });

    it('drops agent and workflow ids when those features are gated off', async () => {
      const { record, form } = renderTools({
        features: { ...allOffFeatures, tools: true },
        availableAgentTools: toAgentTools([{ id: 'web-search', type: 'tool' }]),
      });

      await toolOf(record, SET_AGENT_TOOLS_TOOL_NAME).execute!(
        {
          tools: [
            { id: 'web-search', name: 'Web Search' },
            { id: 'some-agent', name: 'Some Agent' },
            { id: 'some-workflow', name: 'Some Workflow' },
          ],
        } as never,
        {} as never,
      );

      expect(form().getValues('tools')).toEqual({ 'web-search': true });
      expect(form().getValues('agents')).toEqual({});
      expect(form().getValues('workflows')).toEqual({});
    });

    it('lists available tool ids and descriptions in the tool description', () => {
      const { record } = renderTools({
        features: { ...allOffFeatures, tools: true },
        availableAgentTools: toAgentTools([
          { id: 'web-search', description: 'Search the web' },
          { id: 'http-fetch', description: 'Fetch a URL' },
        ]),
      });
      const tool = toolOf(record, SET_AGENT_TOOLS_TOOL_NAME);

      expect(tool.description).toContain('web-search');
      expect(tool.description).toContain('Search the web');
      expect(tool.description).toContain('http-fetch');
      expect(tool.description).toContain('Fetch a URL');
    });

    it('requires both id and name for each entry', () => {
      const { record } = renderTools({
        features: { ...allOffFeatures, tools: true },
        availableAgentTools: toAgentTools([{ id: 'web-search', description: 'Search the web' }]),
      });
      const schema = toolSchema(record, SET_AGENT_TOOLS_TOOL_NAME);

      expect(schema.safeParse({ tools: [{ id: 'web-search', name: 'Web Search' }] }).success).toBe(true);
      expect(schema.safeParse({ tools: [{ id: 'web-search' }] }).success).toBe(false);
      expect(schema.safeParse({ tools: [{ id: 'web-search', name: '' }] }).success).toBe(false);
      expect(schema.safeParse({ tools: ['web-search'] }).success).toBe(false);
    });

    it('constrains the id field to the provided ids', () => {
      const { record } = renderTools({
        features: { ...allOffFeatures, tools: true },
        availableAgentTools: toAgentTools([{ id: 'web-search' }]),
      });
      const schema = toolSchema(record, SET_AGENT_TOOLS_TOOL_NAME);

      expect(schema.safeParse({ tools: [{ id: 'web-search', name: 'Web Search' }] }).success).toBe(true);
      expect(schema.safeParse({ tools: [{ id: 'unknown-tool', name: 'Unknown' }] }).success).toBe(false);
    });
  });

  describe('set-agent-workspace-id tool', () => {
    it('exposes a workspaceId field in the schema', () => {
      const { record } = renderTools({ features: allOffFeatures });
      expect(toolShape(record, SET_AGENT_WORKSPACE_ID_TOOL_NAME).workspaceId).toBeDefined();
      expect(toolSchema(record, SET_AGENT_WORKSPACE_ID_TOOL_NAME).safeParse({ workspaceId: 'any-id' }).success).toBe(
        true,
      );
    });

    it('lists available workspaces in the description', () => {
      const { record } = renderTools({
        features: allOffFeatures,
        availableWorkspaces: [
          { id: 'ws-1', name: 'Primary' },
          { id: 'ws-2', name: 'Secondary' },
        ],
      });
      const tool = record[SET_AGENT_WORKSPACE_ID_TOOL_NAME];

      expect(tool.description).toContain('ws-1');
      expect(tool.description).toContain('Primary');
      expect(tool.description).toContain('ws-2');
      expect(tool.description).toContain('Secondary');
    });

    it('constrains workspaceId to the provided ids when workspaces are available', () => {
      const { record } = renderTools({
        features: allOffFeatures,
        availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }],
      });
      const schema = toolSchema(record, SET_AGENT_WORKSPACE_ID_TOOL_NAME);

      expect(schema.safeParse({ workspaceId: 'ws-1' }).success).toBe(true);
      expect(schema.safeParse({ workspaceId: 'unknown-workspace' }).success).toBe(false);
    });

    it('writes workspaceId to the form when provided', async () => {
      const { record, form } = renderTools({
        features: allOffFeatures,
        availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }],
      });

      await record[SET_AGENT_WORKSPACE_ID_TOOL_NAME].execute!({ workspaceId: 'ws-1' } as never, {} as never);

      expect(form().getValues('workspaceId')).toBe('ws-1');
    });

    it('does not set workspaceId when omitted', async () => {
      const { record, form } = renderTools({
        features: allOffFeatures,
        availableWorkspaces: [{ id: 'ws-1', name: 'Primary' }],
      });

      await record[SET_AGENT_WORKSPACE_ID_TOOL_NAME].execute!({} as never, {} as never);

      expect(form().getValues('workspaceId')).toBeUndefined();
    });
  });

  describe('set-agent-model tool', () => {
    it('lists only the allowed models in the description', () => {
      const { record } = renderTools({
        features: { ...allOffFeatures, model: true },
        availableModels: [{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }],
      });
      const tool = record[SET_AGENT_MODEL_TOOL_NAME];

      expect(tool.description).toContain('Available models');
      expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o');
      expect(tool.description).not.toContain('anthropic');
    });

    it('accepts only allowed provider/name pairs in the schema', () => {
      const { record } = renderTools({
        features: { ...allOffFeatures, model: true },
        availableModels: [{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }],
      });
      expect(toolShape(record, SET_AGENT_MODEL_TOOL_NAME).model).toBeDefined();
      const schema = toolSchema(record, SET_AGENT_MODEL_TOOL_NAME);
      expect(schema.safeParse({ model: { provider: 'openai', name: 'gpt-4o' } }).success).toBe(true);
      expect(schema.safeParse({ model: { provider: 'anthropic', name: 'claude-opus-4-7' } }).success).toBe(false);
    });

    it('respects a combined provider-wildcard + specific-model allowlist in the description', () => {
      const { record } = renderTools({
        features: { ...allOffFeatures, model: true },
        availableModels: [
          { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
          { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o-mini' },
          { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-opus-4-7' },
        ],
      });
      const tool = record[SET_AGENT_MODEL_TOOL_NAME];

      expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o');
      expect(tool.description).toContain('provider: openai (OpenAI), name: gpt-4o-mini');
      expect(tool.description).toContain('provider: anthropic (Anthropic), name: claude-opus-4-7');
      expect(tool.description).not.toContain('claude-haiku-4-5');
      expect(tool.description).not.toContain('mistral');
    });

    it('respects a combined provider-wildcard + specific-model allowlist in the schema', () => {
      const { record } = renderTools({
        features: { ...allOffFeatures, model: true },
        availableModels: [
          { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
          { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o-mini' },
          { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-opus-4-7' },
        ],
      });
      const schema = toolSchema(record, SET_AGENT_MODEL_TOOL_NAME);

      expect(schema.safeParse({ model: { provider: 'openai', name: 'gpt-4o' } }).success).toBe(true);
      expect(schema.safeParse({ model: { provider: 'openai', name: 'gpt-4o-mini' } }).success).toBe(true);
      expect(schema.safeParse({ model: { provider: 'anthropic', name: 'claude-opus-4-7' } }).success).toBe(true);
      expect(schema.safeParse({ model: { provider: 'anthropic', name: 'claude-haiku-4-5' } }).success).toBe(false);
      expect(schema.safeParse({ model: { provider: 'mistral', name: 'mistral-large' } }).success).toBe(false);
    });
  });
});
