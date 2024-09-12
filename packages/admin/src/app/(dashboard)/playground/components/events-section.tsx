import { RefinedIntegrationEvent } from '@arkw/core';

import Image from 'next/image';
import Link from 'next/link';

import { Text } from '@/components/ui/text';

import { toTitleCase } from '@/lib/string';
import { cn } from '@/lib/utils';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

function EventSection({
  integrationName,
  events,
  icon,
}: {
  integrationName: IconName;
  events: Record<string, RefinedIntegrationEvent>;
  icon: string;
}) {
  return (
    <div className="flex flex-col gap-[0.62rem]">
      <div className="flex items-center bg-arkw-bg-13 rounded-xs px-4 py-[0.38rem] gap-[0.62rem]">
        <Icon name="action" className="text-arkw-el-3" />
        <p className="text-sm">Events</p>
      </div>
      <div className="flex max-h-[30vh] overflow-scroll flex-wrap gap-2 ">
        {events
          ? Object.entries(events).map(item => {
              const [_, event] = item;

              return (
                <Link
                  key={event.key}
                  href={`/playground/event/${integrationName}?name=${event.key}`}
                  className="w-[18rem] hover:bg-arkw-bg-4/80 transition-colors flex items-center gap-[0.62rem] bg-arkw-bg-13 px-[0.62rem] py-2 rounded-[0.375rem] border-[0.5px] border-arkw-border-1"
                >
                  <span
                    className={cn(
                      'bg-arkw-bg-4 shrink-0 h-7 w-7 rounded-xs grid place-items-center',
                      integrationName.toLocaleLowerCase() === 'x' ? 'bg-transparent' : 'bg-arkw-el-6 ',
                    )}
                  >
                    <Image width={20} height={20} src={icon} alt={integrationName} />
                  </span>
                  <div className="w-[18rem] truncate">
                    <Text size={'sm'} weight={'medium'} className="truncate">
                      {toTitleCase(event.label || '', '_')}
                    </Text>
                    <Text className="text-arkw-el-2 text-[0.6rem]">{event.description} </Text>
                  </div>
                </Link>
              );
            })
          : null}
      </div>
    </div>
  );
}

export { EventSection };
