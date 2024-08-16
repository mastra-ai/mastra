import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { AutomationConditionConj } from '../../types';

export const ConditionConjDropdown = ({
  conj,
  updateConj,
}: {
  conj: AutomationConditionConj;
  updateConj: (conj: AutomationConditionConj) => void;
}) => {
  const options = ['and', 'or'] as AutomationConditionConj[];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="text-kp-el-3 bg-kp-bg-11 inline h-full flex-shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap rounded p-1 text-xs">
          {conj.toLocaleUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-fit">
        <DropdownMenuLabel className="sr-only">Switch</DropdownMenuLabel>
        {options.map(name => (
          <DropdownMenuItem
            key={name}
            onClick={() => {
              updateConj(name);
            }}
          >
            <span className="text-sm font-medium capitalize">{name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
