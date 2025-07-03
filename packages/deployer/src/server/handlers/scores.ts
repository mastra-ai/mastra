import type { ScoreRowData, StoragePagination } from '@mastra/core';
import {
  getScorersHandler as getOriginalScorersHandler,
  getScoresByRunIdHandler as getOriginalScoresByRunIdHandler,
  getScoresByEntityIdHandler as getOriginalScoresByEntityIdHandler,
  saveScoreHandler as getOriginalSaveScoreHandler,
} from '@mastra/server/handlers/scores';
import type { Context } from 'hono';
import { handleError } from './error';

export async function getScorersHandler(c: Context) {
  try {
    const scorers = await getOriginalScorersHandler();
    return c.json(scorers);
  } catch (error) {
    return handleError(error, 'Error getting scorers');
  }
}

export async function getScoresByRunIdHandler(c: Context) {
  const mastra = c.get('mastra');
  const runId = c.req.param('runId');
  const page = parseInt(c.req.query('page') || '0');
  const perPage = parseInt(c.req.query('perPage') || '10');
  const pagination: StoragePagination = { page, perPage };

  try {
    const scores = await getOriginalScoresByRunIdHandler({
      mastra,
      runId,
      pagination,
    });

    return c.json(scores);
  } catch (error) {
    return handleError(error, 'Error getting scores by run id');
  }
}

export async function getScoresByEntityIdHandler(c: Context) {
  const mastra = c.get('mastra');
  const entityId = c.req.param('entityId');
  const entityType = c.req.param('entityType');
  const page = parseInt(c.req.query('page') || '0');
  const perPage = parseInt(c.req.query('perPage') || '10');

  const pagination: StoragePagination = { page, perPage };

  try {
    const scores = await getOriginalScoresByEntityIdHandler({
      mastra,
      entityId,
      entityType,
      pagination,
    });

    return c.json(scores);
  } catch (error) {
    return handleError(error, 'Error getting scores by entity id');
  }
}

export async function saveScoreHandler(c: Context) {
  const mastra = c.get('mastra');
  const score: ScoreRowData = await c.req.json();

  try {
    const result = await getOriginalSaveScoreHandler({
      mastra,
      score,
    });

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error saving score');
  }
}
