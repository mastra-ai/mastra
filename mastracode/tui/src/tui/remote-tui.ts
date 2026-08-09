import { createInterface } from 'node:readline';

import type { AgentControllerEvent, MastraDBMessage, PlanResume } from '@mastra/client-js';
import { isKnownAgentControllerEvent } from '@mastra/client-js';

import type { MastraTUIBackend, MastraTUIRemoteSnapshot } from './remote-backend.js';

const LOCAL_ONLY_COMMANDS = new Set([
  '/api-keys',
  '/browser',
  '/diff',
  '/hooks',
  '/login',
  '/mcp',
  '/observability',
  '/plugins',
  '/prune',
  '/sandbox',
  '/skills',
]);

export interface RemoteMastraTUIOptions {
  readonly backend: MastraTUIBackend;
  readonly input?: AsyncIterable<string>;
  readonly write?: (line: string) => void;
}

function messageText(message: MastraDBMessage): string {
  return message.content.parts
    .filter((part): part is typeof part & { text: string } => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
}

function defaultInput(): AsyncIterable<string> {
  return createInterface({ input: process.stdin, output: process.stdout, terminal: true });
}

export class RemoteMastraTUI {
  readonly #backend: MastraTUIBackend;
  readonly #input: AsyncIterable<string>;
  readonly #write: (line: string) => void;

  constructor(options: RemoteMastraTUIOptions) {
    this.#backend = options.backend;
    this.#input = options.input ?? defaultInput();
    this.#write = options.write ?? (line => process.stdout.write(`${line}\n`));
  }

  async run(): Promise<void> {
    const connection = await this.#backend.start({
      onSnapshot: snapshot => this.#renderSnapshot(snapshot),
      onEvent: event => this.#renderEvent(event),
      onError: error => this.#write(`Connection error: ${error instanceof Error ? error.message : String(error)}`),
    });
    try {
      for await (const raw of this.#input) {
        const line = raw.trim();
        if (!line) continue;
        if (line === '/quit' || line === '/exit') break;
        try {
          await this.#dispatch(line);
        } catch (error) {
          this.#write(`Command error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } finally {
      connection.unsubscribe();
    }
  }

  #renderSnapshot(snapshot: MastraTUIRemoteSnapshot): void {
    this.#write(`Connected: ${snapshot.threadId ?? 'new thread'} · ${snapshot.modeId} · ${snapshot.modelId}`);
    for (const message of snapshot.messages) {
      const text = messageText(message);
      if (text) this.#write(`${message.role}: ${text}`);
    }
    if (snapshot.displayState?.isRunning) this.#write('Run active; live events resumed.');
  }

  #renderEvent(event: AgentControllerEvent): void {
    if (!isKnownAgentControllerEvent(event)) return;
    switch (event.type) {
      case 'message_end': {
        const text = messageText(event.message);
        if (text) this.#write(`assistant: ${text}`);
        break;
      }
      case 'tool_start':
        this.#write(`tool: ${event.toolName} (${event.toolCallId})`);
        break;
      case 'tool_end':
        this.#write(`tool ${event.toolCallId}: ${event.isError ? 'failed' : 'complete'}`);
        break;
      case 'tool_approval_required':
        this.#write(`Approval required: ${event.toolName} (${event.toolCallId}); use /approve or /decline.`);
        break;
      case 'tool_suspended':
        this.#write(`Input required: ${event.toolName} (${event.toolCallId}); use /resume <id> <value>.`);
        break;
      case 'agent_start':
        this.#write('Agent running…');
        break;
      case 'agent_end':
        this.#write(`Agent stopped${event.reason ? `: ${event.reason}` : ''}.`);
        break;
      case 'error':
        this.#write(
          `Agent error: ${typeof event.error === 'string' ? event.error : (event.error.message ?? 'Unknown error')}`,
        );
        break;
      default:
        break;
    }
  }

  async #dispatch(line: string): Promise<void> {
    if (!line.startsWith('/')) {
      await this.#backend.sendMessage(line);
      return;
    }

    const [command, ...args] = line.split(/\s+/);
    if (LOCAL_ONLY_COMMANDS.has(command!)) {
      this.#write(`${command} requires embedded mcode.`);
      return;
    }

    switch (command) {
      case '/help':
        this.#write(
          '/mode /model /threads /new /switch /goal /permissions /approve /decline /resume /steer /follow-up /abort /quit',
        );
        break;
      case '/abort':
        await this.#backend.abort();
        break;
      case '/mode':
        if (args[0]) await this.#backend.switchMode(args[0]);
        else
          this.#write(
            (await this.#backend.listModes()).map(mode => `${mode.id}${mode.name ? ` (${mode.name})` : ''}`).join('\n'),
          );
        break;
      case '/model':
        if (args[0]) await this.#backend.switchModel(args[0]);
        else this.#write((await this.#backend.listModels()).map(model => model.id).join('\n'));
        break;
      case '/threads':
        this.#write(
          (await this.#backend.listThreads())
            .map(thread => `${thread.id}${thread.title ? ` · ${thread.title}` : ''}`)
            .join('\n'),
        );
        break;
      case '/new':
        this.#write(`Thread: ${(await this.#backend.createThread(args.join(' ') || undefined)).id}`);
        break;
      case '/switch':
        if (!args[0]) throw new Error('Usage: /switch <thread-id>');
        await this.#backend.switchThread(args[0]);
        break;
      case '/approve':
      case '/decline':
        if (!args[0]) throw new Error(`Usage: ${command} <tool-call-id>`);
        await this.#backend.approveTool(args[0], command === '/approve');
        break;
      case '/resume': {
        if (!args[0] || args.length < 2) throw new Error('Usage: /resume <tool-call-id> <value>');
        const value = args.slice(1).join(' ');
        let response: string | string[] | PlanResume = value;
        try {
          response = JSON.parse(value) as string | string[] | PlanResume;
        } catch {}
        await this.#backend.respondToToolSuspension(args[0], response);
        break;
      }
      case '/steer':
        await this.#backend.steer(args.join(' '));
        break;
      case '/follow-up':
        await this.#backend.followUp(args.join(' '));
        break;
      case '/goal':
        if (args[0] === 'clear') await this.#backend.clearGoal();
        else if (args.length) await this.#backend.setGoal(args.join(' '));
        else this.#write(JSON.stringify(await this.#backend.getGoal(), null, 2));
        break;
      case '/permissions':
        this.#write(JSON.stringify(await this.#backend.getPermissions(), null, 2));
        break;
      default:
        this.#write(`Unknown remote command: ${command}`);
    }
  }
}
