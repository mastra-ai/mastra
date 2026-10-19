import { ArrowUpRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { wayOutLabels } from './error-message';
import type { ErrorMessage } from './error-message';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';

export interface ErrorNoticeProps {
  message: ErrorMessage;
  action?: ReactNode;
  className?: string;
}

export function ErrorNotice({ message, action, className }: ErrorNoticeProps) {
  const { title, why, reassurance, fix, wayOut } = message;
  const wayOutLink = wayOut && (
    <Button
      variant="link"
      iconEnd={<ArrowUpRightIcon />}
      render={<a href={wayOut.href} target="_blank" rel="noopener noreferrer" />}
    >
      {wayOutLabels[wayOut.kind]}
    </Button>
  );

  return (
    <Notice
      variant="destructive"
      title={title}
      className={className}
      action={
        (action || wayOutLink) && (
          <div className="flex flex-wrap items-center gap-3">
            {action}
            {wayOutLink}
          </div>
        )
      }
    >
      <Notice.Message>{[why, reassurance, fix].filter(Boolean).join(' ')}</Notice.Message>
    </Notice>
  );
}
