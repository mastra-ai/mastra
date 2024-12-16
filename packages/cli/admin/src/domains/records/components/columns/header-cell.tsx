import { Icon } from '@/components/icon';

import { IconName } from '@/types/icons';

export const HeaderCell = ({ icon, header }: { icon?: IconName; header: string; field?: any }) => {
  return (
    <div
      className={`relative isolate h-full flex max-w-full items-center py-[12px] pl-[11px] text-[0.813rem]/[16px] hover:cursor-pointer`}
    >
      <div className="justify-left gap-2 flex w-[70%] items-center">
        {icon && <Icon name={icon} className="text-mastra-el-3 inline-block h-4 w-4 flex-shrink-0" />}
        <span className="text-mastra-el-6 overflow-hidden text-ellipsis whitespace-nowrap font-normal">{header}</span>
      </div>
    </div>
  );
};
