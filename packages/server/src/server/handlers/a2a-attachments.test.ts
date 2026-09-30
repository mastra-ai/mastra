import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MessageSendParams } from '@mastra/core/a2a';
import { Agent } from '@mastra/core/agent';
import { WorkspaceAttachmentsProcessor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryTaskStore } from '../a2a/store';
import { handleMessageSend, handleMessageStream } from './a2a';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
const NOTE =
  /\[Attachment \\"report\.xlsx\\" \(.+?\) was uploaded to the workspace at (.+?)\. Use workspace tools to read it\.\]/;

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function setup() {
  const basePath = await mkdtemp(join(tmpdir(), 'a2a-attachments-'));
  dirs.push(basePath);
  const prompts: string[] = [];
  const record = (props: { prompt: unknown }) => prompts.push(JSON.stringify(props.prompt));
  const agent = new Agent({
    inputProcessors: [
      new WorkspaceAttachmentsProcessor({
        extensions: ['.xlsx'],
        mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      }),
    ],
    id: 'sheet-agent',
    name: 'sheet-agent',
    instructions: 'Analyse spreadsheets',
    model: createMockModel({ mockText: 'done', spyGenerate: record, spyStream: record }),
    workspace: new Workspace({ filesystem: new LocalFilesystem({ basePath }) }),
  });
  return { agent, basePath, prompts };
}

const message = (file: MessageSendParams['message']['parts'][number]): MessageSendParams => ({
  message: {
    messageId: 'm1',
    kind: 'message',
    role: 'user',
    parts: [{ kind: 'text', text: 'Summarise this' }, file],
  },
});

const inlineSheet = {
  kind: 'file' as const,
  file: { bytes: BYTES.toString('base64'), mimeType: XLSX, name: 'report.xlsx' },
};
const remoteSheet = {
  kind: 'file' as const,
  file: { uri: 'https://example.com/report.xlsx', mimeType: XLSX, name: 'report.xlsx' },
};

async function send(agent: Agent, params: MessageSendParams) {
  return handleMessageSend({
    requestId: 'r1',
    params: { ...params, configuration: { blocking: true } },
    taskStore: new InMemoryTaskStore(),
    agent,
    agentId: 'sheet-agent',
    requestContext: new RequestContext(),
  });
}

async function stream(agent: Agent, params: MessageSendParams) {
  const events: unknown[] = [];
  for await (const event of handleMessageStream({
    requestId: 'r1',
    params,
    taskStore: new InMemoryTaskStore(),
    agent,
    agentId: 'sheet-agent',
    requestContext: new RequestContext(),
  })) {
    events.push(event);
  }
  return events;
}

describe('A2A spreadsheet attachments', () => {
  describe('when message/send carries an inline spreadsheet', () => {
    it('stores the bytes in the workspace and sends the model a note', async () => {
      const { agent, basePath, prompts } = await setup();
      await send(agent, message(inlineSheet));
      const path = prompts.join('').match(NOTE)?.[1];
      expect(path).toBeDefined();
      expect(prompts.join('')).not.toContain('"type":"file"');
      expect(await readFile(join(basePath, path!))).toEqual(BYTES);
    });
  });

  describe('when message/stream carries an inline spreadsheet', () => {
    it('stores the bytes in the workspace and sends the model a note', async () => {
      const { agent, basePath, prompts } = await setup();
      await stream(agent, message(inlineSheet));
      const path = prompts.join('').match(NOTE)?.[1];
      expect(path).toBeDefined();
      expect(await readFile(join(basePath, path!))).toEqual(BYTES);
    });
  });

  describe('when message/send references a spreadsheet by URI', () => {
    it('fails without calling the model', async () => {
      const { agent, prompts } = await setup();
      const result = await send(agent, message(remoteSheet));
      expect(JSON.stringify(result)).toMatch(/inline/i);
      expect(prompts).toHaveLength(0);
    });
  });

  describe('when message/stream references a spreadsheet by URI', () => {
    it('fails without calling the model', async () => {
      const { agent, prompts } = await setup();
      const events = await stream(agent, message(remoteSheet));
      expect(JSON.stringify(events)).toMatch(/inline/i);
      expect(prompts).toHaveLength(0);
    });
  });
});
