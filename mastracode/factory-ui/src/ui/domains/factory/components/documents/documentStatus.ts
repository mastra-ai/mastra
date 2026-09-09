import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { CircleCheck, CircleDashed, FileWarning, type LucideIcon } from 'lucide-react';

import type { FactoryDocumentStatus } from '../../services/documents';

/** How each sync status reads in the inventory. */
export const DOCUMENT_STATUS_STYLE: Record<
  FactoryDocumentStatus,
  { icon: LucideIcon; tone: BadgeVariant; label: string }
> = {
  present: { icon: CircleCheck, tone: 'green', label: 'present' },
  missing: { icon: CircleDashed, tone: 'neutral', label: 'missing' },
  oversize: { icon: FileWarning, tone: 'yellow', label: 'too large' },
};
