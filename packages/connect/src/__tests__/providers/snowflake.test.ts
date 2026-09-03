import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSnowflakeTools } from '../../providers/snowflake.js';

const TOKEN = 'fake-test-token';

const EXPECTED_TOOLS = [
  'snowflake_execute_sql',
  'snowflake_get_statement_status',
  'snowflake_cancel_statement',
  'snowflake_list_databases',
  'snowflake_list_tables',
  'snowflake_describe_table',
];

const sqlResponse = {
  statementHandle: 'handle-abc',
  requestId: 'req-1',
  sqlState: '00000',
  code: '0',
  statementStatus: 'SUCCESS',
  progress: 'Statement executed successfully',
  message: 'Statement executed successfully',
  createdOn: 1788400000000,
  resultSetMetaData: {
    format: 'json',
    rowType: [{ name: 'id' }, { name: 'name' }],
    numRows: 2,
  },
  data: [
    ['1', 'alpha'],
    ['2', 'beta'],
  ],
};

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createSnowflakeTools>[0]) {
  return createSnowflakeTools({
    connectionId: 'c_snw1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createSnowflakeTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createSnowflakeTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createSnowflakeTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createSnowflakeTools({ allowTools: ['snowflake_execute_sql'] });
    expect(Object.keys(tools)).toEqual(['snowflake_execute_sql']);
    expect(() => createSnowflakeTools({ allowTools: ['snowflake_nope'] })).toThrow(/snowflake_nope/);
  });

  it('POSTs statements to api/v2/statements and shapes rows by column name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(sqlResponse));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'snowflake_execute_sql').execute(
      { statement: 'SELECT id, name FROM t', warehouse: 'WH', database: 'DB1', schema: 'PUBLIC', timeout: 30 },
      {} as never,
    );
    expect(result).toMatchObject({
      statementHandle: 'handle-abc',
      status: 'SUCCESS',
      columns: ['id', 'name'],
      numRows: 2,
    });
    expect((result as { rows: unknown[] }).rows).toEqual([
      { id: '1', name: 'alpha' },
      { id: '2', name: 'beta' },
    ]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://example.test/v2/connections/c_snw1/proxy/api/v2/statements');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      statement: 'SELECT id, name FROM t',
      warehouse: 'WH',
      database: 'DB1',
      schema: 'PUBLIC',
      timeout: 30,
    });
  });

  it('surfaces async RUNNING statements so callers can poll', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ statementHandle: 'handle-abc', statementStatus: 'RUNNING', message: '' }, { status: 202 }),
      )
      .mockResolvedValueOnce(Response.json(sqlResponse));
    const tools = makeTools(fetchMock);

    const running = (await tool(tools, 'snowflake_execute_sql').execute(
      { statement: 'SELECT 1', warehouse: 'WH', database: 'DB1', schema: 'PUBLIC' },
      {} as never,
    )) as { status: string };
    expect(running.status).toBe('RUNNING');

    const done = await tool(tools, 'snowflake_get_statement_status').execute(
      { statementHandle: 'handle-abc' },
      {} as never,
    );
    expect(done).toMatchObject({ status: 'SUCCESS' });
    const [pollUrl] = fetchMock.mock.calls[1]!;
    expect(String(pollUrl)).toBe('https://example.test/v2/connections/c_snw1/proxy/api/v2/statements/handle-abc');
  });

  it('passes the partition query param when fetching partitioned results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(sqlResponse));
    const tools = makeTools(fetchMock);
    await tool(tools, 'snowflake_get_statement_status').execute(
      { statementHandle: 'handle/abc+2', partition: 3 },
      {} as never,
    );
    const [url] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe(
      `/v2/connections/c_snw1/proxy/api/v2/statements/${encodeURIComponent('handle/abc+2')}`,
    );
    expect(parsed.searchParams.get('partition')).toBe('3');
  });

  it('cancels a statement via POST :handle/cancel', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ statementStatus: 'SUCCESS', message: 'Statement execution canceled.' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'snowflake_cancel_statement').execute(
      { statementHandle: 'handle-abc' },
      {} as never,
    );
    expect(result).toEqual({ status: 'SUCCESS', message: 'Statement execution canceled.' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://example.test/v2/connections/c_snw1/proxy/api/v2/statements/handle-abc/cancel');
    expect(init.method).toBe('POST');
  });

  it('lists databases via SHOW DATABASES and extracts names', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        statementHandle: 'h1',
        statementStatus: 'SUCCESS',
        message: '',
        resultSetMetaData: { rowType: [{ name: 'created_on' }, { name: 'name' }], numRows: 2 },
        data: [
          ['2026-01-01', 'DB1'],
          ['2026-01-02', 'DB2'],
        ],
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'snowflake_list_databases').execute({ warehouse: 'WH' }, {} as never);
    expect(result).toEqual({ databases: ['DB1', 'DB2'] });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).statement).toBe('SHOW DATABASES LIMIT 50');
  });

  it('lists tables with validated identifiers interpolated', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        statementHandle: 'h2',
        statementStatus: 'SUCCESS',
        message: '',
        resultSetMetaData: { rowType: [{ name: 'name' }, { name: 'database_name' }], numRows: 1 },
        data: [['ORDERS', 'DB1']],
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'snowflake_list_tables').execute(
      { warehouse: 'WH', database: 'DB1', schema: 'PUBLIC' },
      {} as never,
    );
    expect(result).toEqual({ tables: ['ORDERS'] });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).statement).toBe('SHOW TABLES IN DB1.PUBLIC LIMIT 50');
  });

  it('rejects identifier-injection attempts at the schema layer without calling fetch', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);

    for (const malicious of [
      'PUBLIC; DROP TABLE ORDERS',
      'PUBLIC--',
      'PUBLIC" OR 1=1',
      "PUBLIC'; DELETE FROM t",
      'PUBLIC.SECRET',
    ]) {
      const rejected = await tool(tools, 'snowflake_list_tables').execute(
        { warehouse: 'WH', database: 'DB1', schema: malicious },
        {} as never,
      );
      expect(rejected).toMatchObject({ error: true });
    }

    const badTable = await tool(tools, 'snowflake_describe_table').execute(
      { warehouse: 'WH', database: 'DB1', schema: 'PUBLIC', table: 'T; SELECT * FROM secrets' },
      {} as never,
    );
    expect(badTable).toMatchObject({ error: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('describes a table into typed column records', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        statementHandle: 'h3',
        statementStatus: 'SUCCESS',
        message: '',
        resultSetMetaData: {
          rowType: [
            { name: 'name' },
            { name: 'type' },
            { name: 'kind' },
            { name: 'null?' },
            { name: 'default' },
            { name: 'comment' },
          ],
          numRows: 1,
        },
        data: [['ID', 'NUMBER(38,0)', 'COLUMN', 'N', null, 'primary id']],
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'snowflake_describe_table').execute(
      { warehouse: 'WH', database: 'DB1', schema: 'PUBLIC', table: 'ORDERS' },
      {} as never,
    );
    expect(result).toEqual({
      columns: [
        { name: 'ID', type: 'NUMBER(38,0)', kind: 'COLUMN', nullable: false, default: null, comment: 'primary id' },
      ],
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).statement).toBe('DESCRIBE TABLE DB1.PUBLIC.ORDERS');
  });

  it('falls back to MASTRA_SNOWFLAKE_CONNECTION_ID at execute time', async () => {
    vi.stubEnv('MASTRA_SNOWFLAKE_CONNECTION_ID', 'c_env9');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          statementHandle: 'h',
          statementStatus: 'SUCCESS',
          message: '',
          resultSetMetaData: { rowType: [] },
          data: [],
        }),
      );
    const tools = createSnowflakeTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'snowflake_list_databases').execute({ warehouse: 'WH' }, {} as never);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/v2/connections/c_env9/proxy/api/v2/statements');
  });

  it('throws missing_connection_id when unresolvable', async () => {
    vi.stubEnv('MASTRA_SNOWFLAKE_CONNECTION_ID', '');
    const tools = createSnowflakeTools({ client: { accessToken: TOKEN, baseUrl: 'https://example.test' } });
    await expect(
      tool(tools, 'snowflake_list_databases').execute({ warehouse: 'WH' }, {} as never),
    ).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
  });
});
