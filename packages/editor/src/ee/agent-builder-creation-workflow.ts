import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod-v4';

import {
  resolveName,
  resolveDescription,
  resolveInstructions,
  resolveWorkspaceId,
  routeTools,
  resolveSkills,
  resolveModel,
  resolveBrowserEnabled,
} from './handlers';

/**
 * Agent Builder Creation Workflow
 *
 * A sequence of steps — one per field — that turns a plain-language description
 * into an agent configuration covering every field the playground agent-builder
 * client tools can set:
 * - `name` (set-agent-name)
 * - `description` (set-agent-description)
 * - `instructions` (set-agent-instructions)
 * - `workspaceId` (set-agent-workspace-id)
 * - `tools` / `agents` / `workflows` (set-agent-tools, routed by type)
 * - `skills` (set-agent-skills)
 * - `model` (set-agent-model)
 * - `browserEnabled` (set-agent-browser-enabled)
 *
 * Each step's `execute` is a thin, Mastra-specific adapter: it unwraps the
 * workflow context and delegates the actual field computation to a pure handler
 * in `./handlers`. Handlers receive explicit domain arguments (e.g. a
 * `description: string` or `availableAgentTools: AvailableAgentTool[]`), never a
 * workflow `ctx`.
 *
 * The output mirrors `AgentBuilderEditFormValues` for the tool-owned fields.
 * The form's `visibility` and `avatarUrl` are intentionally omitted — no client
 * tool sets those.
 */

const modelSchema = z.object({
  provider: z.string(),
  name: z.string(),
});

const idNameEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
});

const availableAgentToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['tool', 'agent', 'workflow']),
});

const inputSchema = z.object({
  description: z.string().min(1).describe('Plain-language description of the agent to build'),
  name: z.string().optional().describe('Optional explicit agent name; otherwise derived from the description'),
  instructions: z.string().optional().describe('Optional explicit system prompt; otherwise generated'),
  workspaceId: z.string().optional().describe('Optional workspace id to attach the agent to'),
  tools: z.array(idNameEntrySchema).optional().describe('Tools/agents/workflows to enable, each as { id, name }'),
  availableAgentTools: z
    .array(availableAgentToolSchema)
    .optional()
    .describe('Available tools/agents/workflows used to classify the selected tool entries by type'),
  skills: z.array(idNameEntrySchema).optional().describe('Stored skills to attach, each as { id, name }'),
  model: modelSchema.optional().describe('Model to use, as { provider, name }'),
  browserEnabled: z.boolean().optional().describe('Whether to enable browser access for the agent'),
});

// Accumulating config-in-progress threaded from step to step.
const configSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  workspaceId: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  agents: z.record(z.string(), z.boolean()).optional(),
  workflows: z.record(z.string(), z.boolean()).optional(),
  skills: z.record(z.string(), z.boolean()).optional(),
  model: modelSchema.optional(),
  browserEnabled: z.boolean().optional(),
});

const outputSchema = z.object({
  name: z.string(),
  description: z.string(),
  instructions: z.string(),
  workspaceId: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  agents: z.record(z.string(), z.boolean()).optional(),
  workflows: z.record(z.string(), z.boolean()).optional(),
  skills: z.record(z.string(), z.boolean()).optional(),
  model: modelSchema.optional(),
  browserEnabled: z.boolean().optional(),
});

type WorkflowInput = z.infer<typeof inputSchema>;
type Config = z.infer<typeof configSchema>;

const setDescriptionStep = createStep({
  id: 'set-agent-description',
  description: 'Set the agent description',
  inputSchema,
  outputSchema: configSchema,
  execute: async ({ inputData }) => {
    return { description: resolveDescription(inputData.description) };
  },
});

const setNameStep = createStep({
  id: 'set-agent-name',
  description: 'Set the agent name',
  inputSchema: configSchema,
  outputSchema: configSchema,
  execute: async ({ inputData, getInitData }) => {
    const init = getInitData<WorkflowInput>();
    const config = inputData as Config;
    return { ...config, name: resolveName(init.description, init.name) };
  },
});

const setInstructionsStep = createStep({
  id: 'set-agent-instructions',
  description: 'Set the agent instructions',
  inputSchema: configSchema,
  outputSchema: configSchema,
  execute: async ({ inputData, getInitData }) => {
    const init = getInitData<WorkflowInput>();
    const config = inputData as Config;
    return {
      ...config,
      instructions: resolveInstructions(config.name ?? '', config.description ?? '', init.instructions),
    };
  },
});

const setWorkspaceIdStep = createStep({
  id: 'set-agent-workspace-id',
  description: 'Set the agent workspace id',
  inputSchema: configSchema,
  outputSchema: configSchema,
  execute: async ({ inputData, getInitData }) => {
    const init = getInitData<WorkflowInput>();
    const config = inputData as Config;
    return { ...config, workspaceId: resolveWorkspaceId(init.workspaceId) };
  },
});

const setToolsStep = createStep({
  id: 'set-agent-tools',
  description: 'Set the agent tools/agents/workflows',
  inputSchema: configSchema,
  outputSchema: configSchema,
  execute: async ({ inputData, getInitData }) => {
    const init = getInitData<WorkflowInput>();
    const config = inputData as Config;
    if (!init.tools) {
      return config;
    }
    const routed = routeTools(init.tools, init.availableAgentTools ?? []);
    return { ...config, tools: routed.tools, agents: routed.agents, workflows: routed.workflows };
  },
});

const setSkillsStep = createStep({
  id: 'set-agent-skills',
  description: 'Set the agent skills',
  inputSchema: configSchema,
  outputSchema: configSchema,
  execute: async ({ inputData, getInitData }) => {
    const init = getInitData<WorkflowInput>();
    const config = inputData as Config;
    return { ...config, skills: init.skills ? resolveSkills(init.skills) : undefined };
  },
});

const setModelStep = createStep({
  id: 'set-agent-model',
  description: 'Set the agent model',
  inputSchema: configSchema,
  outputSchema: configSchema,
  execute: async ({ inputData, getInitData }) => {
    const init = getInitData<WorkflowInput>();
    const config = inputData as Config;
    return { ...config, model: resolveModel(init.model) };
  },
});

const setBrowserEnabledStep = createStep({
  id: 'set-agent-browser-enabled',
  description: 'Set whether the agent has browser access',
  inputSchema: configSchema,
  outputSchema,
  execute: async ({ inputData, getInitData }) => {
    const init = getInitData<WorkflowInput>();
    const config = inputData as Config;
    return {
      name: config.name ?? '',
      description: config.description ?? '',
      instructions: config.instructions ?? '',
      workspaceId: config.workspaceId,
      tools: config.tools,
      agents: config.agents,
      workflows: config.workflows,
      skills: config.skills,
      model: config.model,
      browserEnabled: resolveBrowserEnabled(init.browserEnabled),
    };
  },
});

export const agentBuilderCreationWorkflow = createWorkflow({
  id: 'agent-builder-creation',
  description: 'Turn a plain-language description into an agent configuration for the agent builder',
  inputSchema,
  outputSchema,
  steps: [
    setDescriptionStep,
    setNameStep,
    setInstructionsStep,
    setWorkspaceIdStep,
    setToolsStep,
    setSkillsStep,
    setModelStep,
    setBrowserEnabledStep,
  ],
})
  .then(setDescriptionStep)
  .then(setNameStep)
  .then(setInstructionsStep)
  .then(setWorkspaceIdStep)
  .then(setToolsStep)
  .then(setSkillsStep)
  .then(setModelStep)
  .then(setBrowserEnabledStep)
  .commit();
