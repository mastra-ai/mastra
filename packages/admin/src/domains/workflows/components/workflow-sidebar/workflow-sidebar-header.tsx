// import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icon';
import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { IconName } from '@/types/icons';

import { useWorkflowContext } from '../../context/workflow-context';

const typeToIcon: { [key: string]: IconName } = {
  trigger: 'trigger',
  action: 'enrich',
  path: 'rule',
};

type WorkflowSidebarHeaderProps = {
  title: string;
} & ({ onBackToList?: never; type?: never } | { onBackToList: () => void; type: 'trigger' | 'action' | 'path' });

export function WorkflowSidebarHeader({ onBackToList, title, type }: WorkflowSidebarHeaderProps) {
  const { setSelectedBlock } = useWorkflowContext();
  return (
    <div className="border-mastra-border-1 flex items-center gap-1 border-b-[0.3px] px-4 py-3">
      {onBackToList ? (
        <>
          <IconButton
            icon="list-mini"
            title="view library"
            className="p-0"
            iconClassname="text-mastra-el-2"
            onClick={onBackToList}
          />
          <Icon name="chevron-down" className="text-mastra-el-2 h-[10px] w-[10px] -rotate-90" />
          <Icon name={typeToIcon[type]} className="text-mastra-el-3 h-4 w-4" />
        </>
      ) : (
        <Icon name="list-mini" className="text-mastra-el-3 h-4 w-4" />
      )}
      <Text size={'sm'} weight={'medium'} className="text-mastra-el-3 text-[0.8125rem]">
        {title}
      </Text>

      <IconButton icon="cancel" size="sm" className="ml-auto" onClick={() => setSelectedBlock(undefined)} />
    </div>
  );
}
