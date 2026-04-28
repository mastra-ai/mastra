import type { MastraClient } from '@mastra/client-js';

/**
 * Fetches the latest 'comment' feedback record for each experiment result
 * and returns a map of result id (`sourceId`) → comment text.
 *
 * Comments are persisted via `client.createFeedback({ feedbackType: 'comment', sourceId: resultId, ... })`,
 * so this is the read-side counterpart used to rehydrate the Review UI on page load.
 */
export async function fetchResultCommentsByExperiment(
  client: MastraClient,
  experimentId: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const { feedback } = await client.listFeedback({
      filters: { feedbackType: 'comment', experimentId },
      pagination: { page: 0, perPage: 1000 },
      orderBy: { field: 'timestamp', direction: 'DESC' },
    });
    for (const f of feedback) {
      const sourceId = f.sourceId;
      if (!sourceId || result.has(sourceId)) continue;
      const text = f.comment ?? (typeof f.value === 'string' ? f.value : '');
      if (text) result.set(sourceId, text);
    }
  } catch {
    // Surface as "no comments" rather than blocking the rehydrate
  }
  return result;
}
