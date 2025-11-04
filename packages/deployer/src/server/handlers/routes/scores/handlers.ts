import type { ScoreRowData } from '@mastra/core/evals';
import type { StoragePagination } from '@mastra/core/storage';
import {
  listScorersHandler as getOriginalListScorersHandler,
  listScoresByRunIdHandler as getOriginalScoresByRunIdHandler,
  listScoresByScorerIdHandler as getOriginalScoresByScorerIdHandler,
  listScoresByEntityIdHandler as getOriginalScoresByEntityIdHandler,
  saveScoreHandler as getOriginalSaveScoreHandler,
  getScorerHandler as getOriginalScorerHandler,
} from '@mastra/server/handlers/scores';
import type { Context } from 'hono';
import { handleError } from '../../error';
import { parsePage, parsePerPage } from '../../utils/query-parsers';

export async function listScorersHandler(c: Context) {
  try {
    const scorers = await getOriginalListScorersHandler({
      mastra: c.get('mastra'),
      requestContext: c.get('requestContext'),
    });
    return c.json(scorers);
  } catch (error) {
    return handleError(error, 'Error listing scorers');
  }
}

export async function getScorerHandler(c: Context) {
  const mastra = c.get('mastra');
  const scorerId = c.req.param('scorerId');
  const requestContext = c.get('requestContext');

  const scorer = await getOriginalScorerHandler({
    mastra,
    scorerId,
    requestContext,
  });

  return c.json(scorer);
}

export async function listScoresByRunIdHandler(c: Context) {
  const mastra = c.get('mastra');
  const runId = c.req.param('runId');
  const page = parsePage(c.req.query('page'));
  const perPage = parsePerPage(c.req.query('perPage'), 10);
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

export async function listScoresByScorerIdHandler(c: Context) {
  const mastra = c.get('mastra');
  const scorerId = c.req.param('scorerId');
  const page = parsePage(c.req.query('page'));
  const perPage = parsePerPage(c.req.query('perPage'), 10);
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

export async function listScoresByEntityIdHandler(c: Context) {
  const mastra = c.get('mastra');
  const entityId = c.req.param('entityId');
  const entityType = c.req.param('entityType');
  const page = parsePage(c.req.query('page'));
  const perPage = parsePerPage(c.req.query('perPage'), 10);

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
