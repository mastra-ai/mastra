import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { listUsersInputSchemaChecked } from '../providers/microsoft-excel/tools/list-users.js';
import { createMicrosoftExcelTools } from '../providers/microsoft-excel/tools.js';

const graph = 'https://graph.microsoft.com/v1.0';

function makeTools() {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json({ value: [] }));
  const tools = createMicrosoftExcelTools({
    connectionId: 'conn-1',
    client: { accessToken: 'token', baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
  });
  return { tools, fetchMock };
}

describe('Microsoft Excel next-page cursors', () => {
  it.each([
    ['microsoft_excel_list_users', {}, `${graph}/users?$top=5&$skiptoken=a`, '/proxy/v1.0/users?$top=5&$skiptoken=a'],
    [
      'microsoft_excel_list_sites',
      {},
      `${graph}/sites?search=*&$skiptoken=b`,
      '/proxy/v1.0/sites?search=*&$skiptoken=b',
    ],
    [
      'microsoft_excel_list_workbooks',
      { driveId: 'b!d' },
      `${graph}/drives/b!d/root/search(q='.xlsx')?$skiptoken=c`,
      "/proxy/v1.0/drives/b!d/root/search(q='.xlsx')?$skiptoken=c",
    ],
  ])('%s follows its own next-page link', async (toolId, input, cursor, expectedPath) => {
    const { tools, fetchMock } = makeTools();
    await tools[toolId]!.execute!({ ...input, cursor }, {});
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://example.test/v2/connections/conn-1${expectedPath}`);
  });

  it.each([
    ['microsoft_excel_list_users', {}, '/v1.0/me/messages'],
    ['microsoft_excel_list_users', {}, `${graph}/users/u1/messages?x=1`],
    ['microsoft_excel_list_sites', {}, `${graph}/users?x=1`],
    ['microsoft_excel_list_workbooks', { driveId: 'b!d' }, `${graph}/drives/b!d/items/i1/content?x=1`],
  ])('%s rejects a cursor for another endpoint (%#) without calling the proxy', async (toolId, input, cursor) => {
    const { tools, fetchMock } = makeTools();
    const result = await tools[toolId]!.execute!({ ...input, cursor }, {});
    expect(result).toMatchObject({ error: true, message: expect.stringContaining('must be the nextCursor') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exposes the cursor pattern and description in the JSON schema the model sees', () => {
    const cursor = z.toJSONSchema(listUsersInputSchemaChecked).properties?.cursor as Record<string, unknown>;
    expect(cursor).toMatchObject({
      type: 'string',
      pattern: expect.stringContaining('graph\\.microsoft\\.com'),
      description: expect.stringContaining('@odata.nextLink'),
    });
  });
});
