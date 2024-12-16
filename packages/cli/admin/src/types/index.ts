import type { Integration, BlueprintWithRelations } from '@mastra/core';

export interface Config {
  integrations: Integration[];
  workflows: BlueprintWithRelations[];
}
