import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';

import type { AgentFormValues } from '../agent-edit-page/utils/form-validation';

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function useSidebarDescriptions(control: Control<AgentFormValues>) {
  const values = useWatch({ control });

  return useMemo(() => {
    const identity = !values.name || !values.model?.provider || !values.model?.name ? 'Required' : values.name;

    const blockCount = (values.instructionBlocks ?? []).filter(
      b => b.type === 'prompt_block_ref' || (b.type === 'prompt_block' && b.content?.trim()),
    ).length;
    const instructions = blockCount === 0 ? 'Required' : pluralize(blockCount, 'block');

    const toolCount = Object.keys(values.tools ?? {}).length + Object.keys(values.integrationTools ?? {}).length;
    const tools = toolCount === 0 ? 'None selected' : pluralize(toolCount, 'tool');

    const agentCount = Object.keys(values.agents ?? {}).length;
    const agents = agentCount === 0 ? 'None selected' : pluralize(agentCount, 'agent');

    const scorerCount = Object.keys(values.scorers ?? {}).length;
    const scorers = scorerCount === 0 ? 'None selected' : pluralize(scorerCount, 'scorer');

    const workflowCount = Object.keys(values.workflows ?? {}).length;
    const workflows = workflowCount === 0 ? 'None selected' : pluralize(workflowCount, 'workflow');

    const memory = values.memory?.enabled ? 'Enabled' : 'Disabled';

    const skillCount = Object.keys(values.skills ?? {}).length;
    const skills = skillCount === 0 ? 'None selected' : pluralize(skillCount, 'skill');

    const variableCount = Object.keys(values.variables?.properties ?? {}).length;
    const variables = variableCount === 0 ? 'None defined' : pluralize(variableCount, 'variable');

    return {
      identity: { description: identity, done: identity !== 'Required' },
      instructions: { description: instructions, done: blockCount > 0 },
      tools: { description: tools, done: toolCount > 0 },
      agents: { description: agents, done: agentCount > 0 },
      scorers: { description: scorers, done: scorerCount > 0 },
      workflows: { description: workflows, done: workflowCount > 0 },
      skills: { description: skills, done: skillCount > 0 },
      memory: { description: memory, done: !!values.memory?.enabled },
      variables: { description: variables, done: variableCount > 0 },
    };
  }, [values]);
}
