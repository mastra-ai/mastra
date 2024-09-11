import type { Integration, BlueprintWithRelations } from '@kepler/core';

export interface Config {
  integrations: Integration[];
  workflows: BlueprintWithRelations[];
}
