import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { WorkspaceAttachmentsProcessor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SEND_AGENT_CONTROLLER_MESSAGE_ROUTE } from './agent-controller';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
const NOTE =
  /\[Attachment \\"report\.xlsx\\" \(.+?\) was uploaded to the workspace at (.+?)\. Use workspace tools to read it\.\]/;

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('SEND_AGENT_CONTROLLER_MESSAGE_ROUTE', () => {
  describe('when the message carries a spreadsheet file', () => {
    it('stores the bytes in the workspace and sends the model a note', async () => {
      const basePath = await mkdtemp(join(tmpdir(), 'controller-attachments-'));
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
      });
      const storage = new InMemoryStore();
      const controller = new AgentController({
        id: 'code',
        storage,
        workspace: new Workspace({ filesystem: new LocalFilesystem({ basePath }) }),
        modes: [{ id: 'build', name: 'Build', default: true, agent }],
      });
      const mastra = new Mastra({ logger: false, agentControllers: { code: controller }, storage });

      await SEND_AGENT_CONTROLLER_MESSAGE_ROUTE.handler({
        mastra,
        controllerId: 'code',
        resourceId: 'user-1',
        message: 'Summarise this',
        files: [{ data: BYTES.toString('base64'), mediaType: XLSX, filename: 'report.xlsx' }],
      } as any);

      await vi.waitFor(() => expect(prompts.join('')).toMatch(NOTE), { timeout: 5000 });
      const prompt = prompts.join('');
      expect(prompt).not.toContain('"type":"file"');
      expect(await readFile(join(basePath, prompt.match(NOTE)![1]!))).toEqual(BYTES);
    });
  });
});
