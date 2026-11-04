import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { AgentController } from '../../agent-controller';
import { MastraLogger } from '../../logger';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { AgentChannels } from '../agent-channels';
import { toChatLogger } from '../chat-logger';
import type { ChannelConfig } from '../types';

type LogRecord = { level: string; message: string; fields: Record<string, unknown> };

class RecordingLogger extends MastraLogger {
  records: LogRecord[] = [];
  debug(message: string, fields: Record<string, unknown>) {
    this.records.push({ level: 'debug', message, fields });
  }
  info(message: string, fields: Record<string, unknown>) {
    this.records.push({ level: 'info', message, fields });
  }
  warn(message: string, fields: Record<string, unknown>) {
    this.records.push({ level: 'warn', message, fields });
  }
  error(message: string, fields: Record<string, unknown>) {
    this.records.push({ level: 'error', message, fields });
  }
}

function fieldsOf(call: (bridge: ReturnType<typeof toChatLogger>) => void) {
  const logger = new RecordingLogger();
  call(toChatLogger(logger));
  return logger.records[0]!.fields;
}

function createAdapter(name: string) {
  return {
    name,
    initialize: async () => {},
    handleWebhook: async () => new Response('ok'),
    encodeThreadId: (...parts: string[]) => parts.join(':'),
    decodeThreadId: (id: string) => id.split(':'),
    channelIdFromThreadId: (id: string) => id.split(':').slice(0, 2).join(':'),
    userName: 'Bot',
  } as any;
}

async function startChannels(logger: RecordingLogger, chatOptions?: ChannelConfig['chatOptions']) {
  const agent = new Agent({
    id: 'bot',
    name: 'Bot',
    instructions: 'You are a test agent',
    model: new MockLanguageModelV2({}),
    channels: { adapters: { discord: createAdapter('discord') }, chatOptions },
  });
  const mastra = new Mastra({ logger, agents: { bot: agent }, storage: new InMemoryStore() });
  const channels = mastra.getChannels()['bot']!;
  await channels.initialize(mastra);
  return { mastra, channels };
}

describe('toChatLogger', () => {
  it('writes the message at the same level with only the component when there are no args', () => {
    const logger = new RecordingLogger();
    toChatLogger(logger).warn('Lock conflict');
    expect(logger.records).toEqual([{ level: 'warn', message: 'Lock conflict', fields: { component: 'chat-sdk' } }]);
  });

  it('spreads a plain object into the log fields', () => {
    expect(fieldsOf(bridge => bridge.debug('Chat instance created', { adapters: ['discord'] }))).toEqual({
      adapters: ['discord'],
      component: 'chat-sdk',
    });
  });

  it('keeps the error text when the only arg is an Error', () => {
    const fields = fieldsOf(bridge => bridge.error('Adapter disconnect failed', new Error('socket closed')));
    expect(JSON.stringify(fields)).toContain('socket closed');
  });

  it('keeps the error text and other fields for { error, threadId }', () => {
    const fields = fieldsOf(bridge =>
      bridge.error('Message processing error', { error: new Error('handler blew up'), threadId: 'discord:1:2' }),
    );
    const serialized = JSON.stringify(fields);
    expect(serialized).toContain('handler blew up');
    expect(fields.threadId).toBe('discord:1:2');
  });

  it('keeps a string arg under args', () => {
    expect(fieldsOf(bridge => bridge.debug('Initializing adapter', 'discord'))).toEqual({
      args: ['discord'],
      component: 'chat-sdk',
    });
  });

  it('keeps an array arg under args', () => {
    expect(fieldsOf(bridge => bridge.debug('Adapters', ['discord', 'slack']))).toEqual({
      args: [['discord', 'slack']],
      component: 'chat-sdk',
    });
  });

  it('keeps several args under args', () => {
    expect(fieldsOf(bridge => bridge.debug('Adapter', 'discord', { id: 1 }))).toEqual({
      args: ['discord', { id: 1 }],
      component: 'chat-sdk',
    });
  });

  it('names nested children after their prefixes', () => {
    const logger = new RecordingLogger();
    const bridge = toChatLogger(logger, { component: 'chat-sdk' });
    bridge.child('discord').child('gateway').info('Connected');
    expect(logger.records[0]!.fields.component).toBe('chat-sdk:discord:gateway');
  });

  it('forwards only levels at or above minLevel, on children too', () => {
    const logger = new RecordingLogger();
    const bridge = toChatLogger(logger, { minLevel: 'warn' }).child('discord');
    bridge.debug('a');
    bridge.info('b');
    bridge.warn('c');
    bridge.error('d');
    expect(logger.records.map(r => r.level)).toEqual(['warn', 'error']);
  });

  it('forwards nothing at silent', () => {
    const logger = new RecordingLogger();
    const bridge = toChatLogger(logger, { minLevel: 'silent' });
    bridge.debug('a');
    bridge.info('b');
    bridge.warn('c');
    bridge.error('d');
    expect(logger.records).toEqual([]);
  });

  it('keeps the error text of a frozen error in a form the logger can write', () => {
    const frozen = Object.freeze(new Error('socket closed'));
    for (const fields of [
      fieldsOf(bridge => bridge.error('Adapter disconnect failed', frozen)),
      fieldsOf(bridge => bridge.error('Message processing error', { error: frozen })),
    ]) {
      expect(JSON.stringify(fields)).toContain('socket closed');
      expect(Object.isExtensible(fields.error)).toBe(true);
    }
  });

  it('still writes the record without throwing when a field cannot be serialized', () => {
    const error = new Error('send failed', { cause: Object.freeze(new Error('socket closed')) });
    expect(fieldsOf(bridge => bridge.error('Adapter disconnect failed', error)).component).toBe('chat-sdk');
  });

  it('does not change the object the caller passed', () => {
    const logger = new RecordingLogger();
    const error = new Error('boom');
    const passed = { error, threadId: 'discord:1:2' };
    toChatLogger(logger).error('Message processing error', passed);
    expect(Object.keys(passed)).toEqual(['error', 'threadId']);
    expect(passed.error).toBe(error);
  });
});

describe('channel logging', () => {
  it('sends real Chat SDK logs to the Mastra logger', async () => {
    const logger = new RecordingLogger();
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await startChannels(logger);
      expect(logger.records).toContainEqual(
        expect.objectContaining({
          level: 'info',
          message: 'Chat instance initialized',
          fields: expect.objectContaining({ component: 'chat-sdk' }),
        }),
      );
      expect(consoleInfo).not.toHaveBeenCalledWith(expect.stringContaining('Chat instance initialized'));
    } finally {
      consoleInfo.mockRestore();
    }
  });

  it('lets chatOptions.logger take the Chat SDK logs instead', async () => {
    const logger = new RecordingLogger();
    const custom = new RecordingLogger();
    await startChannels(logger, { logger: toChatLogger(custom, { component: 'custom' }) });
    const messages = logger.records.map(r => r.message);
    expect(messages).not.toContain('Chat instance initialized');
    expect(custom.records).toContainEqual(
      expect.objectContaining({
        message: 'Chat instance initialized',
        fields: expect.objectContaining({ component: 'custom' }),
      }),
    );
  });

  it('lets a string chatOptions.logger take the Chat SDK logs instead', async () => {
    const logger = new RecordingLogger();
    await startChannels(logger, { logger: 'silent' });
    expect(logger.records.map(r => r.message)).not.toContain('Chat instance initialized');
  });

  it('keeps the Mastra logger when chatOptions.logger is undefined', async () => {
    const logger = new RecordingLogger();
    await startChannels(logger, { logger: undefined });
    expect(logger.records.map(r => r.message)).toContain('Chat instance initialized');
  });

  it('moves Chat SDK logs to a logger set after startup', async () => {
    const first = new RecordingLogger();
    const { mastra, channels } = await startChannels(first);
    const next = new RecordingLogger();
    mastra.setLogger({ logger: next });
    await channels.sdk!.shutdown();
    expect(next.records.map(r => r.message)).toContain('Chat instance shut down');
    expect(first.records.map(r => r.message)).not.toContain('Chat instance shut down');
  });

  it('keeps Chat SDK logs on the Mastra that initialized the channels', async () => {
    const logger = new RecordingLogger();
    const agent = new Agent({
      id: 'bot',
      name: 'Bot',
      instructions: 'You are a test agent',
      model: new MockLanguageModelV2({}),
      channels: { adapters: { discord: createAdapter('discord') } },
    });
    const mastra = new Mastra({ logger, agents: { bot: agent }, storage: new InMemoryStore() });
    const channels = agent.getChannels()!;
    await channels.initialize(mastra);
    new Mastra({ logger: false, agents: { bot: agent }, storage: new InMemoryStore() });
    await channels.sdk!.shutdown();
    expect(logger.records.map(r => r.message)).toContain('Chat instance shut down');
  });

  it('moves channel logs to a new logger when an agent and a controller share a key', async () => {
    const createAgent = (id: string, channels?: ChannelConfig) =>
      new Agent({ id, name: id, instructions: 'You are a test agent', model: new MockLanguageModelV2({}), channels });
    const bot = createAgent('bot', { adapters: { discord: createAdapter('discord') } });
    const controller = new AgentController({
      id: 'controller',
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent('mode') }],
      channels: { adapters: { discord: createAdapter('discord') } },
    });
    const mastra = new Mastra({
      logger: new RecordingLogger(),
      agents: { shared: bot },
      agentControllers: { shared: controller },
      storage: new InMemoryStore(),
    });
    const next = new RecordingLogger();
    mastra.setLogger({ logger: next });
    bot.getChannels()!['log']('info', 'Agent channel log');
    controller.getChannels()!['log']('info', 'Controller channel log');
    expect(next.records.map(r => r.message)).toEqual(
      expect.arrayContaining(['Agent channel log', 'Controller channel log']),
    );
    mastra.__unregisterHooks();
  });

  it('binds the channel component once when channels are set on a registered agent', () => {
    const duplicates: string[] = [];
    class BindingLogger extends RecordingLogger {
      constructor(private bound: string[] = []) {
        super();
      }
      child(bindings: Record<string, unknown>) {
        const keys = Object.keys(bindings);
        duplicates.push(...keys.filter(key => this.bound.includes(key)));
        return new BindingLogger([...this.bound, ...keys]);
      }
    }
    const agent = new Agent({
      id: 'bot',
      name: 'Bot',
      instructions: 'You are a test agent',
      model: new MockLanguageModelV2({}),
    });
    new Mastra({ logger: new BindingLogger(), agents: { bot: agent }, storage: new InMemoryStore() });
    agent.setChannels(new AgentChannels({ adapters: { discord: createAdapter('discord') } }));
    expect(duplicates).toEqual([]);
  });

  it('tags channel logs with a component object so pino writes no stray index fields', () => {
    const bindings: unknown[] = [];
    const logger = Object.assign(new RecordingLogger(), {
      child(binding: unknown) {
        bindings.push(binding);
        return this;
      },
    });
    new AgentChannels({ adapters: { discord: createAdapter('discord') } }).__setLogger(logger);
    expect(bindings).toEqual([{ component: 'CHANNEL' }]);
  });
});
