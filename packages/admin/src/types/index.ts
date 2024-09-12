import type { Integration, BlueprintWithRelations } from '@kpl/core';

export interface Config {
  integrations: Integration[];
  workflows: BlueprintWithRelations[];
}
