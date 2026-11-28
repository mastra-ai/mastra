import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

export interface DocumentEditorHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
}

export function DocumentEditorHeader({ title, description, badge }: DocumentEditorHeaderProps) {
  return (
    <div>
      <span className="flex items-center gap-2">
        <Txt as="h2" variant="heading" tone="ink">
          {title}
        </Txt>
        {badge}
      </span>
      {description ? (
        <Txt variant="body" tone="muted">
          {description}
        </Txt>
      ) : null}
    </div>
  );
}
