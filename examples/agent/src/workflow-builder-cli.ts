/**
 * CLI demo: chat-built, statically-stored, live-registered workflows.
 *
 *   $ pnpm tsx src/workflow-builder-cli.ts
 *   > build me a workflow that takes a city and writes a weather report
 *   [agent describes plan + calls add-tool-step / add-agent-step / add-map-step / save-and-register]
 *   > /run weather-cli {"location":"Helsinki"}
 *   { ...result }
 *   > /list
 *   - weather-cli (active)
 *   > /exit
 *
 * Slash commands:
 *   /list                  list saved workflows
 *   /run <id> <json>       run a saved workflow with the given input
 *   /show                  show the current draft
 *   /reset                 clear the current draft
 *   /exit                  quit
 *
 * Anything else is sent to the workflow-builder-agent.
 */
// Load .env from cwd so OPENAI_API_KEY (and friends) are picked up without
// the user having to `export` them first. `loadEnvFile` is built into Node
// 20.6+ — no dotenv dep. The try/catch makes it a no-op when no .env exists.
try {
  process.loadEnvFile();
} catch {
  /* no .env present — fall through */
}

import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { InMemoryStore } from '@mastra/core/storage';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { z } from 'zod';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { weatherTool } from './mastra/tools/weather-tool';
import { weatherReporterAgent } from './mastra/workflows/weather-report-workflow';
import { workflowBuilderAgent } from './mastra/agents/workflow-builder-agent';

// ============================================================================
// Draft state (per-process)
// ============================================================================

interface WorkflowDraft {
  id?: string;
  description?: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  graph: SerializedStepFlowEntry[];
}

function newDraft(): WorkflowDraft {
  return { graph: [] };
}

// ============================================================================
// Mastra setup
// ============================================================================

const mastra = new Mastra({
  logger: false,
  agents: {
    'workflow-builder-agent': workflowBuilderAgent,
    'weather-reporter': weatherReporterAgent,
  },
  tools: { 'get-weather': weatherTool } as any,
  storage: new InMemoryStore({ id: 'workflow-builder-demo' }),
});

await mastra.startWorkers();

// ============================================================================
// Client tools (close over `draft` + `mastra`)
// ============================================================================

let draft = newDraft();

const clientTools = {
  'set-workflow-id': createTool({
    id: 'set-workflow-id',
    description: 'Set the id of the workflow being built. Kebab-case, descriptive.',
    inputSchema: z.object({ id: z.string().describe('e.g. "weather-report-demo"') }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ id }) => {
      draft.id = id;
      return { ok: true };
    },
  }),
  'set-workflow-description': createTool({
    id: 'set-workflow-description',
    description: 'Set a one-sentence description of what the workflow does.',
    inputSchema: z.object({ description: z.string() }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ description }) => {
      draft.description = description;
      return { ok: true };
    },
  }),
  'set-workflow-input-schema': createTool({
    id: 'set-workflow-input-schema',
    description: 'Set the JSON Schema describing the workflow input (Draft 2020-12 object form).',
    inputSchema: z.object({ schema: z.any() }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ schema }) => {
      draft.inputSchema = schema as Record<string, any>;
      return { ok: true };
    },
  }),
  'set-workflow-output-schema': createTool({
    id: 'set-workflow-output-schema',
    description: 'Set the JSON Schema describing the workflow output (Draft 2020-12 object form).',
    inputSchema: z.object({ schema: z.any() }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ schema }) => {
      draft.outputSchema = schema as Record<string, any>;
      return { ok: true };
    },
  }),
  'add-tool-step': createTool({
    id: 'add-tool-step',
    description: 'Append a tool step that calls a registered tool by id.',
    inputSchema: z.object({
      toolId: z.string().describe('Must be one of the ids returned by list-available-tools.'),
    }),
    outputSchema: z.object({ ok: z.boolean(), stepIndex: z.number() }),
    execute: async ({ toolId }) => {
      draft.graph.push({ type: 'tool', id: toolId, toolId });
      return { ok: true, stepIndex: draft.graph.length - 1 };
    },
  }),
  'add-agent-step': createTool({
    id: 'add-agent-step',
    description: 'Append an agent step that calls a registered agent by id with the previous step output as input.',
    inputSchema: z.object({
      agentId: z.string().describe('Must be one of the ids returned by list-available-agents.'),
    }),
    outputSchema: z.object({ ok: z.boolean(), stepIndex: z.number() }),
    execute: async ({ agentId }) => {
      draft.graph.push({ type: 'agent', id: agentId, agentId });
      return { ok: true, stepIndex: draft.graph.length - 1 };
    },
  }),
  'add-map-step': createTool({
    id: 'add-map-step',
    description:
      'Append a mapping step that reshapes data. mapConfig is an object whose values are { template: "..." }, { value: ... }, or { step: "stepId", path: "field" }.',
    inputSchema: z.object({
      mapConfig: z.record(z.string(), z.any()),
    }),
    outputSchema: z.object({ ok: z.boolean(), stepIndex: z.number() }),
    execute: async ({ mapConfig }) => {
      const id = `mapping_${draft.graph.length}`;
      draft.graph.push({ type: 'mapping', id, mapConfig: JSON.stringify(mapConfig) });
      return { ok: true, stepIndex: draft.graph.length - 1 };
    },
  }),
  'list-available-agents': createTool({
    id: 'list-available-agents',
    description: 'List the agent ids you can reference in add-agent-step.',
    inputSchema: z.object({}),
    outputSchema: z.object({ agents: z.array(z.object({ id: z.string(), description: z.string().optional() })) }),
    execute: async () => {
      const all = mastra.getAgents();
      return {
        agents: Object.entries(all)
          .filter(([id]) => id !== 'workflow-builder-agent')
          .map(([id, a]) => ({ id, description: (a as any).description })),
      };
    },
  }),
  'list-available-tools': createTool({
    id: 'list-available-tools',
    description: 'List the tool ids you can reference in add-tool-step.',
    inputSchema: z.object({}),
    outputSchema: z.object({ tools: z.array(z.object({ id: z.string(), description: z.string().optional() })) }),
    execute: async () => {
      const all = (mastra as any).getTools?.() ?? {};
      return {
        tools: Object.entries(all).map(([id, t]: [string, any]) => ({ id, description: t?.description })),
      };
    },
  }),
  'save-and-register': createTool({
    id: 'save-and-register',
    description:
      'Persist the current draft to storage and live-register it on the Mastra instance so it becomes runnable.',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean(), id: z.string().optional(), error: z.string().optional() }),
    execute: async () => {
      const err = validateDraft(draft);
      if (err) return { ok: false, error: err };
      try {
        await mastra.addStoredWorkflow({
          id: draft.id!,
          description: draft.description,
          inputSchema: draft.inputSchema!,
          outputSchema: draft.outputSchema!,
          graph: draft.graph,
        });
        const savedId = draft.id!;
        draft = newDraft();
        return { ok: true, id: savedId };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  }),
};

function validateDraft(d: WorkflowDraft): string | null {
  if (!d.id) return 'id is not set — call set-workflow-id first';
  if (!d.inputSchema) return 'inputSchema is not set — call set-workflow-input-schema first';
  if (!d.outputSchema) return 'outputSchema is not set — call set-workflow-output-schema first';
  if (d.graph.length === 0) return 'no steps added — add at least one tool/agent/map step';
  return null;
}

// ============================================================================
// REPL
// ============================================================================

const rl = createInterface({ input, output, terminal: input.isTTY });

console.log('Workflow Builder CLI. Type your request, or use /list /run /show /reset /exit.');

const builder = mastra.getAgent('workflow-builder-agent');
const threadId = `workflow-builder-${process.pid}`;

while (true) {
  const line = (await rl.question('> ')).trim();
  if (!line) continue;

  if (line === '/exit') break;

  if (line === '/show') {
    console.log(JSON.stringify(draft, null, 2));
    continue;
  }

  if (line === '/reset') {
    draft = newDraft();
    console.log('Draft cleared.');
    continue;
  }

  if (line === '/list') {
    const store = await (mastra as any).getStorage?.()?.getStore?.('workflowDefinitions');
    if (!store) {
      console.log('No workflow-definitions store available.');
      continue;
    }
    const { definitions } = await store.list({ status: 'active' });
    if (definitions.length === 0) console.log('(no saved workflows)');
    else for (const d of definitions) console.log(`- ${d.id} (${d.status}) — ${d.description ?? ''}`);
    continue;
  }

  if (line.startsWith('/run ')) {
    const rest = line.slice('/run '.length).trim();
    const spaceIdx = rest.indexOf(' ');
    const id = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
    const rawInput = spaceIdx === -1 ? '{}' : rest.slice(spaceIdx + 1);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawInput);
    } catch (e) {
      console.log(`Invalid JSON input: ${(e as Error).message}`);
      continue;
    }
    const wf = mastra.getWorkflow(id);
    if (!wf) {
      console.log(`No workflow registered with id "${id}". Try /list.`);
      continue;
    }
    try {
      const run = await wf.createRun();
      const result = await run.start({ inputData: parsed as any });
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log(`Run failed: ${(e as Error).message}`);
    }
    continue;
  }

  // Anything else → agent
  try {
    const result = await builder.stream(line, {
      threadId,
      resourceId: 'workflow-builder-cli',
      clientTools: clientTools as any,
    });
    for await (const chunk of result.textStream) process.stdout.write(chunk);
    process.stdout.write('\n');
  } catch (e) {
    console.log(`Agent error: ${(e as Error).message}`);
  }
}

rl.close();
process.exit(0);
