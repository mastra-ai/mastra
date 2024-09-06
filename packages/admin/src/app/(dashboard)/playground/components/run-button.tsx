'use client';

import { Icon } from '@/app/components/icon';

function RunApiOrEvent({ context }: { context: 'api' | 'event' }) {
  return (
    <button
      onClick={() => alert('event ran')}
      className="bg-[#33616B]  border-[0.5px] border-[#5699A8] rounded text-sm font-medium text-arkw-el-5 w-[10.25rem] py-2 px-3"
    >
      <Icon name="activity" />
      Run {context}
    </button>
  );
}

export { RunApiOrEvent };
