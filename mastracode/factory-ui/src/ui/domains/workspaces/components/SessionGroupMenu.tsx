import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { LayoutGrid } from 'lucide-react';

import { SESSION_GROUP_BY_LABELS, SESSION_GROUP_BY_OPTIONS } from '../services/sessionGroups';
import type { SessionGroupBy, SessionGroupHeading } from '../services/sessionGroups';

export function SessionGroupMenu({
  groupBy,
  onGroupByChange,
  groups,
  hiddenKeys,
  onVisibilityChange,
}: {
  groupBy: SessionGroupBy;
  onGroupByChange: (groupBy: SessionGroupBy) => void;
  groups: readonly SessionGroupHeading[];
  hiddenKeys: readonly string[];
  onVisibilityChange: (key: string, visible: boolean) => void;
}) {
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={SESSION_GROUP_BY_LABELS[groupBy]}>
        <LayoutGrid aria-hidden />
        <span>Group</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        <DropdownMenu.RadioSub
          label="Group by"
          options={SESSION_GROUP_BY_OPTIONS}
          value={groupBy}
          onValueChange={onGroupByChange}
        />
        {groupBy !== 'none' && (
          <>
            <DropdownMenu.Separator />
            {groups.map(group => (
              <DropdownMenu.CheckboxItem
                key={group.key}
                checked={!hiddenKeys.includes(group.key)}
                onCheckedChange={visible => onVisibilityChange(group.key, visible)}
              >
                <span>{group.label}</span>
              </DropdownMenu.CheckboxItem>
            ))}
          </>
        )}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}
