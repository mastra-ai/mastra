import { Network } from 'lucide-react';
import type { ReactNode } from 'react';

import type { KnowledgeExplorerView } from '../components/KnowledgePageExplorer';
import { IconCodeTree } from '@/ds/icons/central/IconCodeTree';
import { IconFileText } from '@/ds/icons/central/IconFileText';

export const KNOWLEDGE_EXPLORER_VIEWS: ReadonlyArray<{
  value: KnowledgeExplorerView;
  label: string;
  icon: ReactNode;
  narrowOnly: boolean;
}> = [
  { value: 'tree', label: 'Tree', icon: <IconCodeTree />, narrowOnly: true },
  { value: 'graph', label: 'Graph', icon: <Network />, narrowOnly: false },
  { value: 'page', label: 'Page', icon: <IconFileText />, narrowOnly: false },
];
