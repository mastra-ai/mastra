import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { menuItemCheckClass, menuItemClass } from '@mastra/playground-ui/primitives/menu-item';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, GripVertical, LayoutGrid } from 'lucide-react';

import { SESSION_GROUP_BY_OPTIONS } from '../services/sessionGroups';
import type { SessionGroupBy, SessionGroupHeading } from '../services/sessionGroups';

const DRAG_HANDLE_CLASS = 'text-muted-foreground flex size-5 shrink-0 cursor-grab items-center justify-center';

function GroupDragPreview({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div className={cn(overlaySurfaceStyle, 'text-foreground/90 flex items-center rounded-lg')}>
      <span className={cn(DRAG_HANDLE_CLASS, 'cursor-grabbing')}>
        <GripVertical size={14} aria-hidden />
      </span>
      <div className={cn(menuItemClass, 'flex-1')}>
        <span>{label}</span>
        {visible && (
          <span className={menuItemCheckClass}>
            <Check aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

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
            <ContentBlocks
              items={[...groups]}
              onChange={next => onOrderChange(next.map(group => group.key))}
              renderDragPreview={group => (
                <GroupDragPreview label={group.label} visible={!hiddenKeys.includes(group.key)} />
              )}
            >
              {groups.map((group, index) => (
                <ContentBlock key={group.key} draggableId={group.key} index={index}>
                  {dragHandleProps => (
                    <div className="flex items-center">
                      <span
                        {...dragHandleProps}
                        aria-label={`Drag ${group.label}`}
                        className={DRAG_HANDLE_CLASS}
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
