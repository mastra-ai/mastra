// @vitest-environment jsdom
import type { StoredSkillResponse } from '@mastra/client-js';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentTool } from '../../types/agent-tool';
import { useAgentBuilderTool } from '../use-agent-builder-tool';
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

const renderWrapper = (args: {
  features: typeof allOnFeatures;
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
  availableModels?: ModelInfo[];
}) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { name: '', description: '', instructions: '' },
    });
    return React.createElement(FormProvider, methods, children);
  };

  const { result } = renderHook(
    () =>
      useAgentBuilderTool({
        features: args.features,
        availableAgentTools: args.availableAgentTools ?? [],
        availableSkills: args.availableSkills,
        availableModels: args.availableModels,
      }),
    { wrapper: Wrapper },
  );

  return result.current;
};

describe('useAgentBuilderTool (composition + gating wrapper)', () => {
  it('returns all eight atomic tools when every feature is on and all lists are populated', () => {
    const record = renderWrapper({
      features: allOnFeatures,
      availableAgentTools: [{ id: 'tool-a', name: 'Tool A', isChecked: false, type: 'tool' }],
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

    expect(record[SET_AGENT_NAME_TOOL_NAME].id).toBe(SET_AGENT_NAME_TOOL_NAME);
    expect(record[SET_AGENT_TOOLS_TOOL_NAME].id).toBe(SET_AGENT_TOOLS_TOOL_NAME);
    expect(record[SET_AGENT_MODEL_TOOL_NAME].id).toBe(SET_AGENT_MODEL_TOOL_NAME);
  });

  it('returns only the always-on tools when every feature is off', () => {
    const record = renderWrapper({ features: allOffFeatures });

    expect(Object.keys(record).sort()).toEqual(
      [
        SET_AGENT_NAME_TOOL_NAME,
        SET_AGENT_DESCRIPTION_TOOL_NAME,
        SET_AGENT_INSTRUCTIONS_TOOL_NAME,
        SET_AGENT_WORKSPACE_ID_TOOL_NAME,
      ].sort(),
    );
  });

  it('omits the tools tool when features.tools is false', () => {
    const record = renderWrapper({ features: { ...allOnFeatures, tools: false } });
    expect(record[SET_AGENT_TOOLS_TOOL_NAME]).toBeUndefined();
  });

  it('omits the skills tool when features.skills is true but no skills are available', () => {
    const record = renderWrapper({ features: { ...allOnFeatures, skills: true }, availableSkills: [] });
    expect(record[SET_AGENT_SKILLS_TOOL_NAME]).toBeUndefined();
  });

  it('includes the skills tool when features.skills is true and skills are available', () => {
    const record = renderWrapper({
      features: { ...allOnFeatures, skills: true },
      availableSkills: [buildSkill('skill-a')],
    });
    expect(record[SET_AGENT_SKILLS_TOOL_NAME]).toBeDefined();
  });

  it('omits the model tool when features.model is true but no models are available', () => {
    const record = renderWrapper({ features: { ...allOnFeatures, model: true }, availableModels: [] });
    expect(record[SET_AGENT_MODEL_TOOL_NAME]).toBeUndefined();
  });

  it('includes the model tool when features.model is true and models are available', () => {
    const record = renderWrapper({
      features: { ...allOnFeatures, model: true },
      availableModels: [{ provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' }],
    });
    expect(record[SET_AGENT_MODEL_TOOL_NAME]).toBeDefined();
  });

  it('omits the browserEnabled tool when features.browser is false', () => {
    const record = renderWrapper({ features: { ...allOnFeatures, browser: false } });
    expect(record[SET_AGENT_BROWSER_ENABLED_TOOL_NAME]).toBeUndefined();
  });
});
