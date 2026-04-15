import type { GetScorerResponse } from '@mastra/client-js';

export type ScorerTableData = GetScorerResponse & {
  id: string;
};
