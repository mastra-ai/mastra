import type { createTool, StoredSkillResponse } from '@mastra/client-js';
import { useMemo } from 'react';

import type { useBuilderAgentFeatures } from './use-builder-agent-features';
import {
  SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
  useSetAgentBrowserEnabledTool,
} from './use-set-agent-browser-enabled-tool';
import { SET_AGENT_DESCRIPTION_TOOL_NAME, useSetAgentDescriptionTool } from './use-set-agent-description-tool';
import { SET_AGENT_INSTRUCTIONS_TOOL_NAME, useSetAgentInstructionsTool } from './use-set-agent-instructions-tool';
import { SET_AGENT_MODEL_TOOL_NAME, useSetAgentModelTool } from './use-set-agent-model-tool';
import { SET_AGENT_NAME_TOOL_NAME, useSetAgentNameTool } from './use-set-agent-name-tool';
import { SET_AGENT_SKILLS_TOOL_NAME, useSetAgentSkillsTool } from './use-set-agent-skills-tool';
import { SET_AGENT_TOOLS_TOOL_NAME, useSetAgentToolsTool } from './use-set-agent-tools-tool';
import { SET_AGENT_WORKSPACE_ID_TOOL_NAME, useSetAgentWorkspaceIdTool } from './use-set-agent-workspace-id-tool';
import type { AgentTool } from '@/domains/agent-builder/types/agent-tool';
import type { ModelInfo } from '@/domains/llm';

export interface AvailableWorkspace {
  id: string;
  name: string;
}

interface UseAgentBuilderToolArgs {
  features: ReturnType<typeof useBuilderAgentFeatures>;
  availableAgentTools: AgentTool[];
  availableWorkspaces?: AvailableWorkspace[];
  availableSkills?: StoredSkillResponse[];
  availableModels?: ModelInfo[];
}

type ClientTool = ReturnType<typeof createTool>;

export function useAgentBuilderTool({
  features,
  availableAgentTools,
  availableWorkspaces = [],
  availableSkills = [],
  availableModels = [],
}: UseAgentBuilderToolArgs): Record<string, ClientTool> {
  // Always call every atomic hook unconditionally to satisfy the rules of hooks.
  // Feature/availability gating is applied to the assembled record below.
  const nameTool = useSetAgentNameTool();
  const descriptionTool = useSetAgentDescriptionTool();
  const instructionsTool = useSetAgentInstructionsTool();
  const toolsTool = useSetAgentToolsTool({ availableAgentTools });
  const skillsTool = useSetAgentSkillsTool({ availableSkills });
  const modelTool = useSetAgentModelTool({ availableModels });
  const browserTool = useSetAgentBrowserEnabledTool();
  const workspaceTool = useSetAgentWorkspaceIdTool({ availableWorkspaces });

  const { tools: toolsEnabled, skills: skillsEnabled, model: modelEnabled, browser: browserEnabled } = features;
  const skillsCount = availableSkills.length;
  const modelsCount = availableModels.length;

  return useMemo(() => {
    const record: Record<string, ClientTool> = {
      // Always on.
      [SET_AGENT_NAME_TOOL_NAME]: nameTool,
      [SET_AGENT_DESCRIPTION_TOOL_NAME]: descriptionTool,
      [SET_AGENT_INSTRUCTIONS_TOOL_NAME]: instructionsTool,
      [SET_AGENT_WORKSPACE_ID_TOOL_NAME]: workspaceTool,
    };

    if (toolsEnabled) {
      record[SET_AGENT_TOOLS_TOOL_NAME] = toolsTool;
    }
    if (skillsEnabled && skillsCount > 0) {
      record[SET_AGENT_SKILLS_TOOL_NAME] = skillsTool;
    }
    if (modelEnabled && modelsCount > 0) {
      record[SET_AGENT_MODEL_TOOL_NAME] = modelTool;
    }
    if (browserEnabled) {
      record[SET_AGENT_BROWSER_ENABLED_TOOL_NAME] = browserTool;
    }

    return record;
  }, [
    nameTool,
    descriptionTool,
    instructionsTool,
    workspaceTool,
    toolsTool,
    skillsTool,
    modelTool,
    browserTool,
    toolsEnabled,
    skillsEnabled,
    modelEnabled,
    browserEnabled,
    skillsCount,
    modelsCount,
  ]);
}
