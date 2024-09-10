'use client';

import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';

import { Icon } from '@/app/components/icon';

function RunApiOrEvent({
  context,
  onClick,
  apiIsRunning,
}: {
  context: 'api' | 'event';
  onClick?: () => void;
  apiIsRunning?: boolean;
}) {
  return (
    <Button
      variant={'ghost'}
      onClick={onClick}
      disabled={apiIsRunning}
      id="api-run-button"
      className="justify-center z-30 bg-transparent absolute inset-0 rounded flex items-center gap-1 text-sm font-medium text-arkw-el-5"
    >
      {apiIsRunning ? (
        <span className="flex gap-1 items-center">
          <Spinner className="w-3 h-3" /> Running ...
        </span>
      ) : (
        <span className="flex gap-1 items-center">
          <Icon name="activity" />
          Run <span className="capitalize">{context}</span>
        </span>
      )}
    </Button>
  );
}

export { RunApiOrEvent };
