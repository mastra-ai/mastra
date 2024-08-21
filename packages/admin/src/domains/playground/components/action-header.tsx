import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

const typeToIcon: { [key: string]: IconName } = {
  trigger: 'trigger',
  action: 'enrich',
  path: 'rule',
};

type ActionPlaygroundSidebarHeaderProps = {
  title: string;
} & ({ onBackToList?: never; type?: never } | { onBackToList: () => void; type: 'trigger' | 'action' | 'path' });

export function ActionPlaygroundSidebarHeader({ onBackToList, title, type }: ActionPlaygroundSidebarHeaderProps) {
  return (
    <div className="border-arkw-border-1 flex items-center gap-1 border-b-[0.3px] px-4 py-3">
      {onBackToList ? (
        <>
          <IconButton
            icon="list-mini"
            title="view library"
            className="p-0"
            iconClassname="text-arkw-el-2"
            onClick={onBackToList}
          />
          <Icon name="chevron-down" className="text-arkw-el-2 h-[10px] w-[10px] -rotate-90" />
          <Icon name={typeToIcon[type]} className="text-arkw-el-3 h-4 w-4" />
        </>
      ) : (
        <Icon name="list-mini" className="text-arkw-el-3 h-4 w-4" />
      )}
      <Text size={'sm'} weight={'medium'} className="text-arkw-el-3 text-[0.8125rem]">
        {title}
      </Text>

      {/* <IconButton icon="x" size="sm" className="ml-auto" onClick={() => setSelectedBlock(undefined)} /> */}
    </div>
  );
}
