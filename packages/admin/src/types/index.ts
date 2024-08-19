import type { Integration, BlueprintWithRelations } from 'core';

export interface Config {
  integrations: Integration[];
  workflows: BlueprintWithRelations[];
}
