'use client';

import { Button } from '@/components/ui/button';

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
      className="justify-center bg-[#33616B] absolute inset-0 rounded flex items-center gap-1 text-sm font-medium text-arkw-el-5"
    >
      <Icon name="activity" />
      {apiIsRunning ? (
        <span>
          Running <span className="capitalize">{context}...</span>
        </span>
      ) : (
        <span>
          Run <span className="capitalize">{context}</span>
        </span>
      )}
    </Button>
  );
}

export { RunApiOrEvent };
