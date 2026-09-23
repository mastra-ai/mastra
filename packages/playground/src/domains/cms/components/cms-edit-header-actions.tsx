import { Badge } from '@mastra/playground-ui/components/Badge';
import type { ReactNode } from 'react';

export interface CmsEditHeaderActionsProps {
  hasDraft: boolean;
  children?: ReactNode;
}

/** Header actions for CMS edit pages: draft badge first, then the page's own controls. */
export function CmsEditHeaderActions({ hasDraft, children }: CmsEditHeaderActionsProps) {
  return (
    <>
      {hasDraft && <Badge variant="blue">Unpublished changes</Badge>}
      {children}
    </>
  );
}
