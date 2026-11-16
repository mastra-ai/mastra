import type { GetAgentResponse } from '@mastra/client-js';

/**
 * Whether an agent is defined by the project rather than by Studio: registered in code (`'code'`) or
 * discovered from an `agents/<name>/` folder (`'fs'`). Studio edits to these agents are stored as an
 * override layered on top of the code definition, so the first save creates the stored record.
 */
export function isCodeBackedAgent(agent: Pick<GetAgentResponse, 'source'> | null | undefined): boolean {
  return agent?.source === 'code' || agent?.source === 'fs';
}
