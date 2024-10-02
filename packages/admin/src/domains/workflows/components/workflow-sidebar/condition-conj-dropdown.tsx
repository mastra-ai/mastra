import type { ConditionConj } from '@mastra/core';

import { Dropdown } from '@/components/ui/dropdown-menu';

export const ConditionConjDropdown = ({
  conj,
  updateConj,
}: {
  conj: ConditionConj;
  updateConj: (conj: ConditionConj) => void;
}) => {
  const options = ['and', 'or'] as ConditionConj[];
  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <button className="text-mastra-el-3 bg-mastra-bg-11 inline h-full flex-shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap rounded p-1 text-xs">
          {conj.toLocaleUpperCase()}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Content align="start" className="w-fit">
        <Dropdown.Label className="sr-only">Switch</Dropdown.Label>
        {options.map(name => (
          <Dropdown.Item
            key={name}
            onClick={() => {
              updateConj(name);
            }}
          >
            <span className="text-sm font-medium capitalize">{name}</span>
          </Dropdown.Item>
        ))}
      </Dropdown.Content>
    </Dropdown>
  );
};
