/**
 * Resolves declarative step definitions to executable Step objects.
 *
 * This is the core of the workflow definition resolution system.
 * Each declarative step type (agent, tool, workflow, transform, suspend)
 * is converted to an actual Step that can be executed.
 */

import { z } from 'zod';

import type { Mastra } from '../../mastra';
import type {
  AgentStepDef,
  ToolStepDef,
  WorkflowStepDef,
  TransformStepDef,
  SuspendStepDef,
  DeclarativeStepDefinition,
} from '../../storage/types';
import type { Step } from '../step';
import { createStep } from '../workflow';
import { parseToolId, type IntegrationProviderType, type MCPIntegrationMetadata } from '../../integrations';

import { evaluateRef, evaluateInputMapping, type EvaluationContext, type VariableRef } from './evaluate-ref';
import { jsonSchemaToZod } from './json-schema-to-zod';

// Re-export types for convenience
export type { AgentStepDef, ToolStepDef, WorkflowStepDef, TransformStepDef, SuspendStepDef, DeclarativeStepDefinition };

/**
 * Interface for the resolver to allow recursive resolution of nested workflows.
 */
export interface StepResolverContext {
  getMastra(): Mastra;
  resolveNestedWorkflow?(workflowId: string): Promise<any>;
}

/**
 * Resolves a declarative step definition to an executable Step.
 *
 * @param mastra - The Mastra instance for accessing agents, tools, workflows
 * @param stepId - The ID for the resulting step
 * @param definition - The declarative step definition
 * @param resolverContext - Optional context for recursive resolution
 * @returns An executable Step object
 */
export function resolveStep(
  mastra: Mastra,
  stepId: string,
  definition: DeclarativeStepDefinition,
  resolverContext?: StepResolverContext,
): Step {
  switch (definition.type) {
    case 'agent':
      return resolveAgentStep(mastra, stepId, definition);
    case 'tool':
      return resolveToolStep(mastra, stepId, definition);
    case 'workflow':
      return resolveWorkflowStep(mastra, stepId, definition, resolverContext);
    case 'transform':
      return resolveTransformStep(stepId, definition);
    case 'suspend':
      return resolveSuspendStep(stepId, definition);
    default:
      throw new Error(`Unknown step type: ${(definition as any).type}`);
  }
}

/**
 * Resolves an agent step definition.
 *
 * The agent can be either code-defined (registered with Mastra) or
 * a stored agent (retrieved from storage).
 */
export function resolveAgentStep(mastra: Mastra, stepId: string, def: AgentStepDef): Step {
  // Build output schema from structuredOutput if provided
  const outputSchema = def.structuredOutput ? jsonSchemaToZod(def.structuredOutput) : z.object({ text: z.string() });

  return createStep({
    id: stepId,
    description: `Agent step calling ${def.agentId}`,
    // Use z.unknown() to accept any input from previous step
    // The actual data extraction is done via getInitData() and getStepResult()
    inputSchema: z.unknown(),
    outputSchema,
    execute: async ({ mastra: stepMastra, getStepResult, getInitData }) => {
      // Get agent by ID - try code-defined first, then stored
      let agent: Awaited<ReturnType<typeof stepMastra.getAgentById>> | undefined;

      try {
        agent = stepMastra?.getAgentById(def.agentId);
      } catch {
        // Agent not found by ID in code-defined agents
      }

      if (!agent) {
        // Try to get stored agent
        try {
          agent = await (stepMastra as any)?.getStoredAgentById?.(def.agentId);
        } catch {
          // Stored agent not found
        }
      }

      if (!agent) {
        throw new Error(`Agent "${def.agentId}" not found (checked code-defined and stored agents)`);
      }

      // Build evaluation context
      const context = buildEvaluationContext(getInitData, getStepResult);

      // Evaluate prompt from input mapping
      const prompt = evaluateRef(def.input.prompt.$ref, context);
      if (prompt === undefined || prompt === null) {
        // Provide detailed error message for debugging
        const availableInputKeys =
          context.input && typeof context.input === 'object'
            ? Object.keys(context.input).join(', ') || '(empty)'
            : '(not an object)';
        throw new Error(
          `Failed to resolve prompt from "${def.input.prompt.$ref}". ` +
            `Available input keys: ${availableInputKeys}. ` +
            `Input value: ${JSON.stringify(context.input)}`,
        );
      }

      // Evaluate optional instructions override
      let instructions: string | undefined;
      if (def.input.instructions) {
        if (typeof def.input.instructions === 'string') {
          instructions = def.input.instructions;
        } else {
          instructions = evaluateRef(def.input.instructions.$ref, context) as string;
        }
      }

      // Generate response from agent
      const generateOptions: Record<string, unknown> = {};
      if (instructions) {
        generateOptions.instructions = instructions;
      }

      const result = await agent.generate([{ role: 'user', content: String(prompt) }], generateOptions);

      // Return structured output if defined, otherwise text
      if (def.structuredOutput && result.object) {
        return result.object;
      }
      return { text: result.text };
    },
  }) as Step;
}

/**
 * Resolves a tool step definition.
 *
 * Supports both regular tools (code-defined and agent tools) and
 * integration tools from providers like Composio, Arcade, MCP, and Smithery.
 *
 * Integration tool IDs follow the format: `provider_toolkitSlug_toolSlug`
 * (e.g., `composio_github_GITHUB_CREATE_ISSUE`)
 */
export function resolveToolStep(mastra: Mastra, stepId: string, def: ToolStepDef): Step {
  return createStep({
    id: stepId,
    description: `Tool step calling ${def.toolId}`,
    // Use z.unknown() to accept any input from previous step
    // The actual data extraction is done via getInitData() and getStepResult()
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
    execute: async ({ mastra: stepMastra, getStepResult, getInitData, requestContext, tracingContext }) => {
      // Get tool - check global tools first, then agent tools
      let tool: any;

      // Try global tools by ID
      try {
        tool = stepMastra?.getToolById?.(def.toolId);
      } catch {
        // Tool not found by ID
      }

      // Try global tools by name
      if (!tool) {
        try {
          tool = stepMastra?.getTool?.(def.toolId);
        } catch {
          // Tool not found by name
        }
      }

      // Search agent tools if not found globally
      if (!tool) {
        const agents = stepMastra?.listAgents?.() || {};
        for (const agent of Object.values(agents)) {
          try {
            const agentTools = await (agent as any).listTools?.({ requestContext });
            if (agentTools) {
              // Check by key
              if (agentTools[def.toolId]) {
                tool = agentTools[def.toolId];
                break;
              }
              // Check by ID
              const foundTool = Object.values(agentTools).find((t: any) => t.id === def.toolId);
              if (foundTool) {
                tool = foundTool;
                break;
              }
            }
          } catch {
            // Error getting agent tools
          }
        }
      }

      // Build evaluation context and resolve inputs
      const context = buildEvaluationContext(getInitData, getStepResult);
      const toolInput = evaluateInputMapping(def.input, context);

      // If tool found in code, execute it directly
      if (tool) {
        if (!tool.execute) {
          throw new Error(`Tool "${def.toolId}" does not have an execute function`);
        }

        // Execute tool with (input, context) signature
        const result = await tool.execute(toolInput, {
          mastra: stepMastra,
          requestContext,
          tracingContext,
        });

        return result;
      }

      // Check if it's an integration tool (format: provider_toolkitSlug_toolSlug)
      const parsedToolId = parseToolId(def.toolId);

      if (parsedToolId.valid) {
        // It's an integration tool - look up cached tool from storage
        const storage = stepMastra?.getStorage();

        if (!storage) {
          throw new Error(
            `Integration tool "${def.toolId}" requires storage to be configured. ` +
              `Storage is needed to look up cached integration tools.`,
          );
        }

        const integrationsStore = await storage.getStore('integrations');

        if (!integrationsStore) {
          throw new Error(
            `Integration tool "${def.toolId}" requires integrations store. ` +
              `Make sure storage is properly configured with integrations support.`,
          );
        }

        // Find the cached tool by provider and toolkit
        const { provider, toolkitSlug, toolSlug } = parsedToolId;

        const cachedToolsResult = await integrationsStore.listCachedTools({
          provider: provider as IntegrationProviderType,
          toolkitSlug,
        });

        const cachedTool = cachedToolsResult.tools?.find((t: any) => t.toolSlug === toolSlug);

        if (!cachedTool) {
          throw new Error(
            `Integration tool "${def.toolId}" not found in cached tools. ` +
              `Make sure the integration is set up and tools are cached.`,
          );
        }

        // Execute integration tool based on provider
        if (provider === 'mcp' || provider === 'smithery') {
          // MCP/Smithery tools require integration metadata for transport config
          const integration = await integrationsStore.getIntegrationById({ id: cachedTool.integrationId });

          if (!integration) {
            throw new Error(`Integration not found for MCP tool "${def.toolId}"`);
          }

          const mcpMetadata = integration.metadata as MCPIntegrationMetadata | undefined;

          if (!mcpMetadata) {
            throw new Error(`MCP integration metadata not found for "${def.toolId}"`);
          }

          // Dynamically import MCPClient from @mastra/mcp
          // Use variable to avoid TypeScript's static module resolution
          const mcpPackage = '@mastra/mcp';
          let MCPClient: any;
          try {
            const mcpModule = await import(/* webpackIgnore: true */ mcpPackage);
            MCPClient = mcpModule.MCPClient;
          } catch {
            throw new Error(
              `MCP tool execution requires @mastra/mcp package. ` + `Install it with: npm install @mastra/mcp`,
            );
          }

          // Build server config based on transport type
          const transport = mcpMetadata.transport || (mcpMetadata.url ? 'http' : 'stdio');
          const serverConfig =
            transport === 'http'
              ? {
                  url: new URL(mcpMetadata.url!),
                  requestInit: mcpMetadata.headers ? { headers: mcpMetadata.headers } : undefined,
                  connectTimeout: 10000,
                }
              : {
                  command: mcpMetadata.command!,
                  args: mcpMetadata.args,
                  env: mcpMetadata.env,
                };

          const client = new MCPClient({
            id: `workflow-mcp-${Date.now()}`,
            servers: { server: serverConfig },
            timeout: 30000,
          });

          try {
            // Get available tools and find the one we need
            const availableTools = await client.listTools();
            const toolEntries = Object.entries(availableTools as Record<string, any>);

            // Find the tool - it might be prefixed with 'server_'
            const toolEntry = toolEntries.find(
              ([name]) =>
                name === cachedTool.toolSlug ||
                name === `server_${cachedTool.toolSlug}` ||
                name.endsWith(`_${cachedTool.toolSlug}`),
            );

            if (!toolEntry) {
              throw new Error(
                `MCP tool "${cachedTool.toolSlug}" not found. Available tools: ${toolEntries.map(([n]) => n).join(', ')}`,
              );
            }

            const [, mcpTool] = toolEntry as [string, any];

            if (!mcpTool.execute) {
              throw new Error(`MCP tool "${cachedTool.toolSlug}" does not have an execute function`);
            }

            // Execute the tool
            const result = await mcpTool.execute(toolInput, {});
            return result;
          } finally {
            await client.disconnect();
          }
        }

        // Composio/Arcade tools - use executeTool from integrations
        // Get the integration to access credentials/metadata
        const integration = await integrationsStore.getIntegrationById({ id: cachedTool.integrationId });

        if (!integration) {
          throw new Error(`Integration not found for tool "${def.toolId}"`);
        }

        const { executeTool } = await import('../../integrations');

        // Build execution options based on provider
        const executionOptions: {
          connectedAccountId?: string;
          userId?: string;
        } = {};

        if (provider === 'composio') {
          // Composio needs connectedAccountId and userId (entity_id) for authentication
          // Frontend stores userId, but we also check entityId for backward compatibility
          const composioMetadata = integration.metadata as
            | { connectedAccountId?: string; entityId?: string; userId?: string }
            | undefined;
          if (composioMetadata?.connectedAccountId) {
            executionOptions.connectedAccountId = composioMetadata.connectedAccountId;
          }
          // Check both userId (frontend) and entityId (legacy) for user identification
          if (composioMetadata?.userId) {
            executionOptions.userId = composioMetadata.userId;
          } else if (composioMetadata?.entityId) {
            executionOptions.userId = composioMetadata.entityId;
          }
        } else if (provider === 'arcade') {
          // Arcade needs userId for authentication
          const arcadeMetadata = integration.metadata as { userId?: string } | undefined;
          if (arcadeMetadata?.userId) {
            executionOptions.userId = arcadeMetadata.userId;
          }
        }

        const result = await executeTool(
          provider,
          cachedTool.toolSlug,
          toolInput as Record<string, unknown>,
          executionOptions,
        );

        if (!result.success) {
          const errorDetails = result.error?.details
            ? ` Details: ${typeof result.error.details === 'string' ? result.error.details : JSON.stringify(result.error.details)}`
            : '';
          throw new Error(`${result.error?.message || 'Tool execution failed'}${errorDetails}`);
        }

        return result.output;
      }

      // Tool not found anywhere
      throw new Error(`Tool "${def.toolId}" not found (checked global tools, agent tools, and integration tools)`);
    },
  }) as Step;
}

/**
 * Resolves a workflow step definition (nested workflow).
 */
export function resolveWorkflowStep(
  mastra: Mastra,
  stepId: string,
  def: WorkflowStepDef,
  resolverContext?: StepResolverContext,
): Step {
  return createStep({
    id: stepId,
    description: `Workflow step calling ${def.workflowId}`,
    // Use z.unknown() to accept any input from previous step
    // The actual data extraction is done via getInitData() and getStepResult()
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
    execute: async ({ mastra: stepMastra, getStepResult, getInitData }) => {
      // Try to get workflow - code-defined first
      let workflow = stepMastra?.getWorkflow?.(def.workflowId);

      // If not found, try workflow definition (stored)
      if (!workflow && resolverContext?.resolveNestedWorkflow) {
        try {
          workflow = await resolverContext.resolveNestedWorkflow(def.workflowId);
        } catch {
          // Not found as definition either
        }
      }

      if (!workflow) {
        throw new Error(`Workflow "${def.workflowId}" not found (checked code-defined and stored definitions)`);
      }

      // Build evaluation context and resolve inputs
      const context = buildEvaluationContext(getInitData, getStepResult);
      const workflowInput = evaluateInputMapping(def.input, context);

      // Execute workflow - createRun returns a Promise
      const run = await workflow.createRun();
      const result = await run.start({ inputData: workflowInput });

      // Return the result if workflow succeeded, otherwise throw
      if (result.status === 'success') {
        return result.result;
      }
      if (result.status === 'failed') {
        throw result.error;
      }
      // For suspended/tripwire states, return the steps output
      return result.steps;
    },
  }) as Step;
}

/**
 * Resolves a transform step definition.
 *
 * Transform steps map data from previous steps/inputs to new outputs.
 * They can also update workflow state.
 */
export function resolveTransformStep(stepId: string, def: TransformStepDef): Step {
  const outputSchema = jsonSchemaToZod(def.outputSchema);

  return createStep({
    id: stepId,
    description: 'Transform step',
    // Use z.unknown() to accept any input from previous step
    // The actual data extraction is done via getInitData() and getStepResult()
    inputSchema: z.unknown(),
    outputSchema,
    execute: async ({ getStepResult, getInitData, state, setState }) => {
      // Build evaluation context
      const stateObj = (typeof state === 'object' && state !== null ? state : {}) as Record<string, unknown>;
      const context = buildEvaluationContext(getInitData, getStepResult, stateObj);

      // Evaluate output mappings
      const output = evaluateInputMapping(def.output, context);

      // Handle state updates if defined
      if (def.stateUpdates && setState) {
        const stateUpdates = evaluateInputMapping(def.stateUpdates, context);
        const newState = { ...stateObj, ...stateUpdates };
        await setState(newState as any);
      }

      return output;
    },
  }) as Step;
}

/**
 * Resolves a suspend step definition.
 *
 * Suspend steps pause workflow execution until resumed with external data.
 */
export function resolveSuspendStep(stepId: string, def: SuspendStepDef): Step {
  const resumeSchema = jsonSchemaToZod(def.resumeSchema);

  return createStep({
    id: stepId,
    description: 'Suspend step - waiting for external input',
    // Use z.unknown() to accept any input from previous step
    // The actual data extraction is done via getInitData() and getStepResult()
    inputSchema: z.unknown(),
    outputSchema: resumeSchema,
    resumeSchema,
    execute: async ({ suspend, resumeData, getStepResult, getInitData }) => {
      // If we have resume data, return it
      if (resumeData !== undefined) {
        return resumeData;
      }

      // Build context and evaluate payload
      const context = buildEvaluationContext(getInitData, getStepResult);
      const payload = def.payload ? evaluateInputMapping(def.payload, context) : {};

      // Suspend with payload
      return suspend(payload);
    },
  }) as Step;
}

/**
 * Builds an evaluation context from step execution parameters.
 *
 * @param getInitData - Function to get workflow initial input
 * @param getStepResult - Function to get previous step results
 * @param state - Current workflow state (optional)
 */
function buildEvaluationContext(
  getInitData: (() => any) | undefined,
  getStepResult: ((step: any) => any) | undefined,
  state?: Record<string, unknown>,
): EvaluationContext {
  const input = getInitData?.() || {};

  // Create a Proxy for steps that lazily fetches step results when accessed.
  // This allows us to support `steps.someStepId.output` references without
  // needing to know all step IDs in advance.
  const steps = new Proxy({} as Record<string, { output: unknown }>, {
    get(_target, stepId: string) {
      if (!getStepResult) {
        return undefined;
      }
      // getStepResult accepts step ID as string and returns the output if successful
      const result = getStepResult(stepId);
      // Wrap in { output: ... } to match expected structure: steps.stepId.output
      return { output: result };
    },
  });

  return {
    input,
    steps,
    state: state || {},
  };
}

/**
 * Type guard to check if a value is a VariableRef
 */
export function isVariableRef(value: unknown): value is VariableRef {
  return typeof value === 'object' && value !== null && '$ref' in value;
}
