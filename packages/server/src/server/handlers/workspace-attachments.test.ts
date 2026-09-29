import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from '../http-exception';
import { routeAttachmentsToWorkspace, WORKSPACE_REQUIRED_ERROR_CODE } from './workspace-attachments';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS = 'application/vnd.ms-excel';

function createAgent(workspace?: Workspace) {
  return new Agent({
    id: 'test-agent',
    name: 'Test agent',
    instructions: 'test',
    model: 'openai/gpt-4o-mini',
    workspace,
  });
}

const tempDirectories: string[] = [];

async function createWorkspace() {
  const basePath = await mkdtemp(join(tmpdir(), 'mastra-attachments-'));
  tempDirectories.push(basePath);
  return { basePath, workspace: new Workspace({ id: 'attachments', filesystem: new LocalFilesystem({ basePath }) }) };
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

const BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff]);
const BASE64 = Buffer.from(BYTES).toString('base64');

function uploadedPath(text: string): string {
  const match = text.match(/(uploads\/[^\s"]+)/);
  if (!match) throw new Error(`No upload path in: ${text}`);
  return match[1]!.replace(/[.\]]+$/, '');
}

describe('routeAttachmentsToWorkspace', () => {
  describe('given messages without whitelisted attachments', () => {
    it.each([
      ['a string', 'hello'],
      ['a text message', [{ role: 'user', content: 'hello' }]],
      [
        'a PDF and an image',
        [
          {
            role: 'user',
            content: [
              { type: 'file', data: 'JVBERi0=', mediaType: 'application/pdf', filename: 'doc.pdf' },
              { type: 'image', image: 'aGVsbG8=', mediaType: 'image/png' },
            ],
          },
        ],
      ],
    ])('when %s is routed then it comes back unchanged without resolving the workspace', async (_label, messages) => {
      const agent = createAgent();
      const getWorkspace = vi.spyOn(agent, 'getWorkspace');

      const result = await routeAttachmentsToWorkspace({ agent, messages, requestContext: new RequestContext() });

      expect(result).toBe(messages);
      expect(getWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('given a spreadsheet attachment and an agent without a workspace', () => {
    it.each([
      ['an XLSX media type', { mediaType: XLSX, filename: 'report.xlsx' }, XLSX],
      ['an XLS media type', { mediaType: XLS, filename: 'report.xls' }, XLS],
      [
        'a generic media type with an .xlsx filename',
        { mediaType: 'application/octet-stream', filename: 'r.XLSX' },
        'application/octet-stream',
      ],
    ])('when %s is routed then a 403 with a stable code is raised', async (_label, part, expectedMediaType) => {
      const messages = [{ role: 'user', content: [{ type: 'file', data: 'UEsDBA==', ...part }] }];

      const error = await routeAttachmentsToWorkspace({
        agent: createAgent(),
        messages,
        requestContext: new RequestContext(),
      }).catch(e => e);

      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(403);
      const body = await error.getResponse().json();
      expect(body).toMatchObject({ code: WORKSPACE_REQUIRED_ERROR_CODE, mediaType: expectedMediaType });
      expect(body.error).toEqual(expect.any(String));
      expect(WORKSPACE_REQUIRED_ERROR_CODE).toBe('WORKSPACE_REQUIRED_FOR_ATTACHMENT');
    });
  });

  describe('given a spreadsheet attachment and an agent with a workspace', () => {
    it.each([
      ['base64', BASE64],
      ['a data URL', `data:${XLSX};base64,${BASE64}`],
      ['a Uint8Array', BYTES],
    ])('when the data is %s then the exact bytes are written under uploads/<uuid>/<name>', async (_label, data) => {
      const { basePath, workspace } = await createWorkspace();
      const messages = [{ role: 'user', content: [{ type: 'file', data, mediaType: XLSX, filename: 'report.xlsx' }] }];

      const [message] = await routeAttachmentsToWorkspace({
        agent: createAgent(workspace),
        messages,
        requestContext: new RequestContext(),
      });

      const path = uploadedPath((message!.content[0] as { text: string }).text);
      expect(path).toMatch(/^uploads\/[0-9a-f-]{36}\/report\.xlsx$/);
      expect(new Uint8Array(await readFile(join(basePath, path)))).toEqual(BYTES);
    });

    it('when it is routed then the file part is replaced by a text part referencing the path', async () => {
      const { workspace } = await createWorkspace();
      const messages = [
        { role: 'user', content: [{ type: 'file', data: BASE64, mediaType: XLSX, filename: 'report.xlsx' }] },
      ];

      const [message] = await routeAttachmentsToWorkspace({
        agent: createAgent(workspace),
        messages,
        requestContext: new RequestContext(),
      });

      expect(message!.content).toEqual([
        {
          type: 'text',
          text: expect.stringMatching(/report\.xlsx.*uploads\/[0-9a-f-]{36}\/report\.xlsx.*workspace/s),
        },
      ]);
      expect(messages[0]!.content[0]!.type).toBe('file');
    });

    it('when the filename tries to escape then the file stays under uploads/', async () => {
      const { basePath, workspace } = await createWorkspace();
      const messages = [
        { role: 'user', content: [{ type: 'file', data: BASE64, mediaType: XLSX, filename: '../../evil.xlsx' }] },
      ];

      const [message] = await routeAttachmentsToWorkspace({
        agent: createAgent(workspace),
        messages,
        requestContext: new RequestContext(),
      });

      const path = uploadedPath((message!.content[0] as { text: string }).text);
      expect(path).toMatch(/^uploads\/[0-9a-f-]{36}\/evil\.xlsx$/);
      expect(resolve(basePath, path).startsWith(join(basePath, 'uploads'))).toBe(true);
      expect(new Uint8Array(await readFile(join(basePath, path)))).toEqual(BYTES);
    });

    it('when it is mixed with other parts then only the spreadsheet is replaced', async () => {
      const { workspace } = await createWorkspace();
      const text = { type: 'text', text: 'Summarize this' };
      const pdf = { type: 'file', data: 'JVBERi0=', mediaType: 'application/pdf', filename: 'doc.pdf' };
      const image = { type: 'image', image: 'aGVsbG8=', mediaType: 'image/png' };
      const messages = [
        {
          role: 'user',
          content: [text, pdf, { type: 'file', data: BASE64, mediaType: XLS, filename: 'a.xls' }, image],
        },
      ];

      const [message] = await routeAttachmentsToWorkspace({
        agent: createAgent(workspace),
        messages,
        requestContext: new RequestContext(),
      });

      expect(message!.content).toEqual([text, pdf, { type: 'text', text: expect.stringContaining('/a.xls') }, image]);
    });
  });

  describe('given an agent whose workspace only has a sandbox', () => {
    it('when a spreadsheet is routed then it is written into the sandbox and replaced by a text part', async () => {
      const writeFiles = vi.fn().mockResolvedValue(undefined);
      const agent = createAgent();
      vi.spyOn(agent, 'getWorkspace').mockResolvedValue({ sandbox: { writeFiles } } as any);

      const [message] = await routeAttachmentsToWorkspace({
        agent,
        messages: [{ role: 'user', content: [{ type: 'file', data: BASE64, mediaType: XLSX, filename: 'r.xlsx' }] }],
        requestContext: new RequestContext(),
      });

      expect(writeFiles).toHaveBeenCalledTimes(1);
      const [[file]] = writeFiles.mock.calls[0]!;
      expect(file.path).toMatch(/^uploads\/[0-9a-f-]{36}\/r\.xlsx$/);
      expect(new Uint8Array(file.content)).toEqual(BYTES);
      expect(message!.content).toEqual([{ type: 'text', text: expect.stringContaining(file.path) }]);
    });
  });

  describe('given a workspace with neither a filesystem nor a writable sandbox', () => {
    it('when a spreadsheet is routed then a 403 is raised', async () => {
      const agent = createAgent();
      vi.spyOn(agent, 'getWorkspace').mockResolvedValue({ sandbox: {} } as any);

      const error = await routeAttachmentsToWorkspace({
        agent,
        messages: [{ role: 'user', content: [{ type: 'file', data: BASE64, mediaType: XLSX, filename: 'r.xlsx' }] }],
        requestContext: new RequestContext(),
      }).catch(e => e);

      expect(error).toBeInstanceOf(HTTPException);
      expect(error.status).toBe(403);
    });
  });
});
