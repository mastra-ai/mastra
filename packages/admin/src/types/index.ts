import { Integration } from '@/domains/plugins/types';
import { AutomationBlueprintWithRelations } from '@/domains/workflows/types';

export interface Config {
  integrations: Integration[];
  workflows: AutomationBlueprintWithRelations[];
}
