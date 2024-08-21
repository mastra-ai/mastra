import { frameWorkIcon } from '@arkw/core';
import { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import { Icon } from '@/app/components/icon';

import { pathAlphabet } from '../../utils';

import { FrameworkIcon } from './action-selector';

interface BlockHeaderWithPathProps {
  category: 'path';
  icon?: unknown;
  pathIndex: number | null;
  pathDropdown: ReactNode;
}

interface BlockHeaderWithTriggerOrActionProps {
  category: 'action' | 'trigger';
  icon: frameWorkIcon;
  pathIndex?: unknown;
  pathDropdown?: never;
}

type BlockHeaderProps = {
  title: string;
  handleEditBlockType?: () => void;
  isCondition?: boolean;
} & (BlockHeaderWithTriggerOrActionProps | BlockHeaderWithPathProps);

function BlockHeader({
  title,
  icon,
  category,
  handleEditBlockType,
  isCondition,
  pathDropdown,
  pathIndex,
}: BlockHeaderProps) {
  return (
    <div className="border-arkw-border-1 flex flex-row items-center gap-4 border-b-[0.3px] p-6">
      <span className="border-arkw-border-2 bg-arkw-bg-9 rounded-sm border-[0.4px] border-solid p-2">
        {category === 'path' ? (
          <>
            {pathIndex === null ? (
              <Icon name="rule" className="h-4 w-4 text-current" />
            ) : (
              <Text size="default" weight="bold" className="px-1 text-current">
                {pathAlphabet[pathIndex]}
              </Text>
            )}
          </>
        ) : (
          <FrameworkIcon icon={icon} className="h-4 w-4 text-current" />
        )}
      </span>
      <Text size="default" className="font-[500] capitalize text-[#f5f5f5]">
        {title}
      </Text>
      {category === 'path' ? (
        pathDropdown
      ) : !isCondition ? (
        <Button
          type="button"
          variant="ghost"
          className="text-2xs text-arkw-el-3 hover:text-arkw-el-6 group ml-auto gap-[5px] p-[2px] px-2"
          onClick={handleEditBlockType}
        >
          <Icon name="reply" className="group-hover:text-arkw-el-6 text-inherit transition-colors" />
          Change
        </Button>
      ) : null}
    </div>
  );
}

export default BlockHeader;
