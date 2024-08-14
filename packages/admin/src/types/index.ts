import { Integration } from '@/domains/integrations/types';
import { AutomationBlueprintWithRelations } from '@/domains/workflows/types';

import { IconName } from './icons';

export interface Config {
  integrations: Integration[];
  workflows: AutomationBlueprintWithRelations[];
}

export const ObjectCategoryEnum = {
  people: 'people',
  companies: 'companies',
  deals: 'deals',
} as const;

export const ObjectCategoryEnumArray = [
  ObjectCategoryEnum.people,
  ObjectCategoryEnum.companies,
  ObjectCategoryEnum.deals,
] as const;

export type ObjectCategory = keyof typeof ObjectCategoryEnum;

export const srtToIcon: Record<ObjectCategory, IconName> = {
  people: 'people',
  companies: 'companies',
  deals: 'handshake',
};
