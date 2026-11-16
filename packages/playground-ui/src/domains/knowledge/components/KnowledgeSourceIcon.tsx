import { scopeSource } from '../lib/pageAddress';
import type { KnowledgePagePayload } from '../pageTypes';

import { cn } from '@/lib/utils';

export function KnowledgeSourceIcon({ page, className }: { page: KnowledgePagePayload; className?: string }) {
  const SourceIcon = scopeSource(page)?.icon;
  if (!SourceIcon) return null;
  return <SourceIcon aria-hidden className={cn('shrink-0 text-foreground', className)} />;
}
