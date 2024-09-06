'use client';

import { Icon } from '@/app/components/icon';

function RunApiOrEvent({ context, onClick }: { context: 'api' | 'event'; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="justify-center bg-[#33616B] absolute inset-0 rounded flex items-center gap-1 text-sm font-medium text-arkw-el-5"
    >
      <Icon name="activity" />
      <span>
        Run <span className="capitalize">{context}</span>
      </span>
    </button>
  );
}

export { RunApiOrEvent };
