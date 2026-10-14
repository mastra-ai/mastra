import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { GripVertical, LayoutGrid } from 'lucide-react';

import { SESSION_GROUP_BY_OPTIONS } from '../services/sessionGroups';
import type { SessionGroupBy, SessionGroupHeading } from '../services/sessionGroups';

export function SessionGroupMenu({
  groupBy,
  onGroupByChange,
  groups,
  hiddenKeys,
  onVisibilityChange,
  onOrderChange,
}: {
  groupBy: SessionGroupBy;
  onGroupByChange: (groupBy: SessionGroupBy) => void;
  groups: readonly SessionGroupHeading[];
  hiddenKeys: readonly string[];
  onVisibilityChange: (key: string, visible: boolean) => void;
  onOrderChange: (keys: string[]) => void;
}) {
  const groupByLabel = SESSION_GROUP_BY_OPTIONS.find(option => option.value === groupBy)?.label;
  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={groupByLabel}>
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
            <ContentBlocks items={[...groups]} onChange={next => onOrderChange(next.map(group => group.key))}>
              {groups.map((group, index) => (
                <ContentBlock key={group.key} draggableId={group.key} index={index}>
                  {dragHandleProps => (
                    <div className="flex items-center">
                      <span
                        {...dragHandleProps}
                        aria-label={`Drag ${group.label}`}
                        className="text-muted-foreground flex size-5 shrink-0 cursor-grab items-center justify-center"
                        onClick={event => event.stopPropagation()}
                        onPointerDown={event => event.stopPropagation()}
                      >
                        <GripVertical size={14} aria-hidden />
                      </span>
                      <DropdownMenu.CheckboxItem
                        className="flex-1"
                        checked={!hiddenKeys.includes(group.key)}
                        onCheckedChange={visible => onVisibilityChange(group.key, visible)}
                      >
                        <span>{group.label}</span>
                      </DropdownMenu.CheckboxItem>
                    </div>
                  )}
                </ContentBlock>
              ))}
            </ContentBlocks>
          </>
        )}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}
