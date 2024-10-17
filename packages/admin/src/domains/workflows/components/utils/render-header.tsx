import { frameWorkIcon } from '@mastra/core';
import { ReactNode } from 'react';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import { cn } from '@/lib/utils';

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
  description?: string;
  handleEditBlockType?: () => void;
  isCondition?: boolean;
  showChangeButton?: boolean;
  classname?: string;
  integrationName?: string;
} & (BlockHeaderWithTriggerOrActionProps | BlockHeaderWithPathProps);

function BlockHeader({
  title,
  description,
  icon,
  category,
  handleEditBlockType,
  isCondition,
  pathDropdown,
  pathIndex,
  showChangeButton = true,
  classname,
  integrationName = '',
}: BlockHeaderProps) {
  const iconNoBorder = ['x', 'system', 'plus-icon'];

  return (
    <div
      className={cn(
        'border-mastra-border-1 flex rounded-t-[0.375rem] items-center gap-3 border-b-[0.3px] p-6',
        classname,
      )}
    >
      <div className="flex gap-3 items-center">
        {category === 'path' ? (
          <>
            {pathIndex === null ? (
              <span className="bg-mastra-el-6 shrink-0 h-7 w-7 rounded-xs grid place-items-center">
                <Icon name="rule" className="h-4 w-4 text-current" />
              </span>
            ) : (
              <span className="border-mastra-border-2 bg-mastra-bg-9 rounded-sm border-[0.4px] border-solid p-2">
                <Text size="default" weight="bold" className="px-1 text-current">
                  {pathAlphabet[pathIndex]}
                </Text>
              </span>
            )}
          </>
        ) : (
          <FrameworkIcon icon={icon} imageSize={20} />
        )}

        <div>
          <Text size="default" className="font-[500] capitalize text-[#f5f5f5]">
            {title}
          </Text>
          <Text size="xs" className="capitalize text-mastra-el-3">
            {description}
          </Text>
        </div>
      </div>

      {category === 'path' ? (
        pathDropdown
      ) : !isCondition && showChangeButton ? (
        <Button
          type="button"
          variant="ghost"
          className="text-2xs text-mastra-el-3 hover:text-mastra-el-6 group ml-auto gap-[5px] p-[2px] px-2"
          onClick={handleEditBlockType}
        >
          <Icon name="reply" className="group-hover:text-mastra-el-6 text-inherit transition-colors" />
          Change
        </Button>
      ) : null}
    </div>
  );
}

export default BlockHeader;
