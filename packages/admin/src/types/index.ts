import { Integration } from '@/domains/integrations/types';
import { Workflow } from '@/domains/workflows/types';

export interface Config {
  integrations: Integration[];
  workflows: Workflow[];
}
