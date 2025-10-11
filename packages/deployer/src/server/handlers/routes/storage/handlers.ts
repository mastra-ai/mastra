import * as handlers from '@mastra/server/handlers/storage';
import type { Context as HonoContext } from 'hono';

export async function getTablesHandler(c: HonoContext) {
  const mastra = c.get('mastra');
  const result = await handlers.getTablesHandler({ mastra });
  return c.json(result);
}

export async function getTableDataHandler(c: HonoContext) {
  const mastra = c.get('mastra');
  const { tableName } = c.req.param();
  const page = Number(c.req.query('page')) || 0;
  const perPage = Number(c.req.query('perPage')) || 50;
  const search = c.req.query('search');

  const result = await handlers.getTableDataHandler({
    mastra,
    tableName: tableName as any,
    page,
    perPage,
    search,
  });

  return c.json(result);
}

export async function getRecordHandler(c: HonoContext) {
  const mastra = c.get('mastra');
  const { tableName } = c.req.param();
  const keys = await c.req.json();

  const result = await handlers.getRecordHandler({
    mastra,
    tableName: tableName as any,
    keys,
  });

  return c.json(result);
}

export async function updateRecordHandler(c: HonoContext) {
  const mastra = c.get('mastra');
  const { tableName } = c.req.param();
  const record = await c.req.json();

  const result = await handlers.updateRecordHandler({
    mastra,
    tableName: tableName as any,
    record,
  });

  return c.json(result);
}

export async function deleteRecordHandler(c: HonoContext) {
  const mastra = c.get('mastra');
  const { tableName } = c.req.param();
  const keys = await c.req.json();

  const result = await handlers.deleteRecordHandler({
    mastra,
    tableName: tableName as any,
    keys,
  });

  return c.json(result);
}

export async function queryTableHandler(c: HonoContext) {
  const mastra = c.get('mastra');
  const { tableName } = c.req.param();
  const page = Number(c.req.query('page')) || 0;
  const perPage = Number(c.req.query('perPage')) || 50;
  const queryParam = c.req.query('query');
  const query = queryParam ? JSON.parse(queryParam) : undefined;

  const result = await handlers.queryTableHandler({
    mastra,
    tableName: tableName as any,
    query,
    page,
    perPage,
  });

  return c.json(result);
}
