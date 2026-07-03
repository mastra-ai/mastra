import { Agent } from '@mastra/core/agent';
import { getDesktopAgentModelConfig } from '../local-model-gateway';
import { desktopAssistant } from './desktop-assistant';
import { createDesktopAgentMemory } from './desktop-memory';

function createDesktopTemplateAgent({
  id,
  name,
  description,
  instructions,
}: {
  id: string;
  name: string;
  description: string;
  instructions: string;
}) {
  return new Agent({
    id,
    name,
    description,
    instructions,
    model: getDesktopAgentModelConfig(),
    memory: createDesktopAgentMemory(id),
    editor: {
      instructions: true,
      tools: true,
    },
  });
}

export const localModelGuide = createDesktopTemplateAgent({
  id: 'local-model-guide',
  name: 'Local Model Guide',
  description: 'Helps configure and troubleshoot local Ollama, LM Studio, or OpenAI-compatible model servers.',
  instructions: `
You help users run Mastra Studio Desktop with local models.

Diagnose Ollama, LM Studio, or custom OpenAI-compatible endpoints from the information the user provides. Give short, concrete setup steps, explain which URL and model id to use, and never claim you can start or control external desktop apps yourself. When the next action belongs in Settings, point the user there directly.
  `.trim(),
});

export const workflowPlanner = createDesktopTemplateAgent({
  id: 'workflow-planner',
  name: 'Workflow Planner',
  description: 'Turns an idea into a Mastra workflow outline with steps, inputs, and failure handling.',
  instructions: `
You turn rough automation ideas into practical Mastra workflow plans.

Identify the trigger, required inputs, durable steps, tools or integrations needed, failure states, and a clear done condition. Keep the output implementation-ready but concise. If a required integration or credential is missing, describe the fallback behavior instead of pretending the workflow can run.
  `.trim(),
});

export const toolDesigner = createDesktopTemplateAgent({
  id: 'tool-designer',
  name: 'Tool Designer',
  description: 'Designs focused Mastra tool contracts for local automations and agent capabilities.',
  instructions: `
You design focused Mastra tools.

For each requested capability, propose the smallest useful tool contract: purpose, input fields, output fields, validation rules, error behavior, and where secrets or local resources should be configured. Prefer one reliable tool over broad generic tools. Do not invent access to files, accounts, or services the user has not connected.
  `.trim(),
});

export const desktopOrchestrator = new Agent({
  id: 'desktop-orchestrator',
  name: 'Desktop Orchestrator',
  description: 'Coordinates the bundled desktop specialists and demonstrates Mastra subagents.',
  instructions: `
You coordinate the bundled Mastra Studio Desktop specialists.

Use Local Model Guide for local model setup, Workflow Planner for process design, and Tool Designer for tool contracts. When a request spans multiple areas, delegate to the relevant specialists, then synthesize one short answer with concrete next steps. If delegation is unavailable, answer directly and say which specialist would normally handle that part.
  `.trim(),
  model: getDesktopAgentModelConfig(),
  memory: createDesktopAgentMemory('desktop-orchestrator'),
  agents: {
    localModelGuide,
    workflowPlanner,
    toolDesigner,
  },
  editor: {
    instructions: true,
    tools: true,
  },
});

export const desktopAgents = {
  desktopAssistant,
  localModelGuide,
  workflowPlanner,
  toolDesigner,
  desktopOrchestrator,
} as const;
