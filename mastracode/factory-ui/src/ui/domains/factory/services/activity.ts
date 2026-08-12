/**
 * Browser-side helper for the Factory activity endpoint.
 *
 * Which of the project's bound sessions have a run in flight. The server owns
 * the answer: a run lives in the session addressed by its own session id, so
 * only the process holding that session can be asked.
 */

import { requestJson } from './request';

/** Session ids (the workspace row key) with an agent run in flight. */
export async function fetchFactoryActivity(baseUrl: string, factoryProjectId: string): Promise<string[]> {
  const data = await requestJson<{ runningSessionIds: string[] }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/activity`,
  );
  return data.runningSessionIds;
}
