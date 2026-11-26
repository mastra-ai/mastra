import { randomUUID } from 'node:crypto';
import { userInfo } from 'node:os';
import { createInterface } from 'node:readline';
import type { PlatformAgent } from '@mastra/platform';
import type { Command } from 'commander';
import pc from 'picocolors';
import { collect } from '../api/index.js';
import { options, platformCommand, print, projectClient, table } from '../platform/shared.js';
import { wrapAction } from '../utils.js';

export function registerAgentsCommand(program: Command) {
  const agents = platformCommand(program, 'agents', 'Create and run managed agents on Mastra Platform');

  agents
    .command('setup')
    .description('Set the project up to run managed agents')
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options(command);
        const platform = await projectClient(opts);
        await platform.setupAgents();
        print(
          opts,
          { projectId: platform.projectId, status: 'ready' },
          () => `${pc.green('Managed agents are ready in')} ${platform.projectId}`,
        );
      }),
    );

  agents
    .command('list')
    .description("List the project's managed agents")
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options(command);
        const records = await (await projectClient(opts)).listAgents();
        const rows = Object.entries(records).map(([id, agent]) => ({ id, name: agent.name }));
        print(opts, rows, () => table(rows, ['id', 'name']));
      }),
    );

  agents
    .command('create')
    .description('Create a managed agent, setting the project up for managed agents first if needed')
    .requiredOption('--name <name>', 'Agent name')
    .requiredOption('--instructions <text>', 'System instructions')
    .option('--description <text>', 'Agent description')
    .option('--model <provider/model>', 'Gateway model, e.g. openai/gpt-5-mini')
    .option('--connection <id>', 'Connect connection whose tools the agent can use (repeatable)', collect, [])
    .option('--skill <id>', 'Stored skill to attach (repeatable)', collect, [])
    .option('--builtin-tool <id>', 'Built-in Platform tool to enable, e.g. list_agents (repeatable)', collect, [])
    .option('--no-code-mode', "Don't expose the agent's tools through code mode")
    .action(
      wrapAction(async (_opts, command: Command) => {
        const opts = options<{
          name: string;
          instructions: string;
          description?: string;
          model?: string;
          connection: string[];
          skill: string[];
          builtinTool: string[];
          codeMode: boolean;
        }>(command);
        const platform = await projectClient(opts);
        if ((await platform.agentsSetupStatus()) !== 'ready') {
          if (!opts.json) console.info(pc.dim(`Setting up managed agents for ${platform.projectId}...`));
          await platform.setupAgents();
        }
        const agent = await platform.createAgent({
          name: opts.name,
          instructions: opts.instructions,
          ...(opts.description ? { description: opts.description } : {}),
          ...(opts.model ? { model: opts.model } : {}),
          ...(opts.connection.length ? { connectionIds: opts.connection } : {}),
          ...(opts.skill.length ? { skillIds: opts.skill } : {}),
          ...(opts.builtinTool.length ? { builtinTools: opts.builtinTool } : {}),
          ...(opts.codeMode ? {} : { codeMode: false }),
        });
        print(opts, { id: agent.id, name: opts.name }, () => `${pc.green('Created agent')} ${opts.name} (${agent.id})`);
      }),
    );

  agents
    .command('delete <agentId>')
    .description('Delete a managed agent')
    .action(
      wrapAction(async (agentId: string, _opts, command: Command) => {
        const opts = options(command);
        await (await projectClient(opts)).getAgent(agentId).delete();
        print(opts, { id: agentId, deleted: true }, () => `${pc.green('Deleted agent')} ${agentId}`);
      }),
    );

  agents
    .command('run <agentId> <message>')
    .description('Send a message to a managed agent and stream its reply')
    .requiredOption('--resource <id>', 'End user the agent acts for')
    .option('--thread <id>', 'Conversation thread to continue or start')
    .action(
      wrapAction(async (agentId: string, message: string, _opts, command: Command) => {
        const opts = options<{ resource: string; thread?: string }>(command);
        const agent = (await projectClient(opts)).getAgent(agentId);
        const text = await streamReply(agent, message, opts.resource, opts.thread, !opts.json);
        if (opts.json) console.info(JSON.stringify({ agentId, text }, null, 2));
        else process.stdout.write('\n');
      }),
    );

  agents
    .command('chat <agentId>')
    .description(
      'Chat with a managed agent: each line you type is a message, and the conversation is kept in one thread',
    )
    .option('--resource <id>', 'End user the agent acts for (defaults to your OS user name)')
    .option('--thread <id>', 'Conversation thread to continue (defaults to a new thread)')
    .action(
      wrapAction(async (agentId: string, _opts, command: Command) => {
        const opts = options<{ resource?: string; thread?: string }>(command);
        const resource = opts.resource ?? `cli-${userInfo().username}`;
        const thread = opts.thread ?? randomUUID();
        const agent = (await projectClient(opts)).getAgent(agentId);

        console.info(
          pc.dim(`Chatting with ${agentId} as ${resource} in thread ${thread}. Type /exit or press Ctrl+D to leave.`),
        );
        // Show a prompt only to a person at a terminal; piped input (scripts, CI) gets just the replies.
        const interactive = Boolean(process.stdin.isTTY);
        const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: interactive });
        let closed = false;
        rl.on('close', () => (closed = true));
        const prompt = () => {
          if (!interactive || closed) return;
          rl.setPrompt(pc.cyan('› '));
          rl.prompt();
        };
        prompt();
        for await (const line of rl) {
          const message = line.trim();
          if (message === '/exit') break;
          if (message) {
            await streamReply(agent, message, resource, thread, true);
            process.stdout.write('\n\n');
          }
          prompt();
        }
        rl.close();
        console.info(
          pc.dim(`\nContinue later: mastra agents chat ${agentId} --resource ${resource} --thread ${thread}`),
        );
      }),
    );

  return agents;
}

/** Streams one reply, saving the exchange to `thread` when given, and returns its text. */
async function streamReply(
  agent: PlatformAgent,
  message: string,
  resource: string,
  thread: string | undefined,
  write: boolean,
): Promise<string> {
  const response = await agent.stream(message, {
    resourceId: resource,
    ...(thread ? { memory: { thread, resource } } : {}),
  });
  let text = '';
  await response.processDataStream({
    onChunk: async chunk => {
      if (chunk.type !== 'text-delta') return;
      text += chunk.payload.text;
      if (write) process.stdout.write(chunk.payload.text);
    },
  });
  return text;
}
