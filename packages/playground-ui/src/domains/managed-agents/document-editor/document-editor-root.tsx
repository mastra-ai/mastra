import type { ReactNode } from 'react';
import { PageLayout } from '@/ds/components/PageLayout';

export interface DocumentEditorProps {
  breadcrumbs: ReactNode;
  title: string;
  children: ReactNode;
}

export function DocumentEditorRoot({ breadcrumbs, title, children }: DocumentEditorProps) {
  return (
    <PageLayout variant="page" body="fixed" breadcrumbs={breadcrumbs}>
      <h1 className="sr-only">{title}</h1>
      <div className="flex h-full min-h-0 gap-2 p-2">{children}</div>
    </PageLayout>
  );
}
