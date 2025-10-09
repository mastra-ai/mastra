import type { ScoreRowData } from '@mastra/core/scores';
import type { StoragePagination } from '@mastra/core/storage';
import {
  getScorersHandler as getOriginalScorersHandler,
  getScoresByRunIdHandler as getOriginalScoresByRunIdHandler,
  getScoresByScorerIdHandler as getOriginalScoresByScorerIdHandler,
  getScoresByEntityIdHandler as getOriginalScoresByEntityIdHandler,
  saveScoreHandler as getOriginalSaveScoreHandler,
  getScorerHandler as getOriginalScorerHandler,
} from '@mastra/server/handlers/scores';
import type { Context } from 'hono';
import { handleError } from '../../error';

export async function getScorersHandler(c: Context) {
  try {
    const scorers = await getOriginalScorersHandler({
      mastra: c.get('mastra'),
      runtimeContext: c.get('runtimeContext'),
    });
    return c.json(scorers);
  } catch (error) {
    return handleError(error, 'Error getting scorers');
  }
}

export async function getScorerHandler(c: Context) {
  const mastra = c.get('mastra');
  const scorerId = c.req.param('scorerId');
  const runtimeContext = c.get('runtimeContext');

  const scorer = await getOriginalScorerHandler({
    mastra,
    scorerId,
    runtimeContext,
  });

  return c.json(scorer);
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

export async function getScoresByScorerIdHandler(c: Context) {
  const mastra = c.get('mastra');
  const scorerId = c.req.param('scorerId');
  const page = parseInt(c.req.query('page') || '0');
  const perPage = parseInt(c.req.query('perPage') || '10');
  const entityId = c.req.query('entityId');
  const entityType = c.req.query('entityType');
  const pagination: StoragePagination = { page, perPage };

  try {
    const scores = await getOriginalScoresByScorerIdHandler({
      mastra,
      scorerId,
      pagination,
      entityId,
      entityType,
    });

    return c.json(scores);
  } catch (error) {
    return handleError(error, 'Error getting scores by scorer id');
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
