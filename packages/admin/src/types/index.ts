import type { Integration, BlueprintWithRelations } from '@arkw/core';

export interface Config {
  integrations: Integration[];
  workflows: BlueprintWithRelations[];
}
