import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { menuItemCheckClass, menuItemClass } from '@mastra/playground-ui/primitives/menu-item';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, GripVertical, LayoutGrid } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { SESSION_GROUP_BY_LABELS } from '../services/sessionGroups';
import type { SessionGroupBy, SessionGroupHeading } from '../services/sessionGroups';
import { SESSION_GROUP_MENU_OPTIONS } from './sessionPropertyOptions';

const MOVE_STEP_BY_KEY: Record<string, -1 | 1> = { ArrowUp: -1, ArrowDown: 1 };

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
  const groupKeys = groups.map(group => group.key);
  const isVisible = (key: string) => !hiddenKeys.includes(key);

  const moveGroupWithKeyboard = (event: KeyboardEvent, key: string) => {
    const step = MOVE_STEP_BY_KEY[event.key];
    if (!event.altKey || step === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const from = groupKeys.indexOf(key);
    const to = from + step;
    if (to < 0 || to >= groupKeys.length) return;
    onOrderChange(groupKeys.toSpliced(from, 1).toSpliced(to, 0, key));
  };

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger hint={SESSION_GROUP_BY_LABELS[groupBy]}>
        <LayoutGrid aria-hidden />
        <span>Group</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent>
        <DropdownMenu.RadioSub
          label="Group by"
          icon={<LayoutGrid aria-hidden />}
          options={SESSION_GROUP_MENU_OPTIONS}
          value={groupBy}
          onValueChange={onGroupByChange}
        />
        {groupBy !== 'none' && (
          <>
            <DropdownMenu.Separator />
            <ContentBlocks
              items={groups}
              onChange={reordered => onOrderChange(reordered.map(group => group.key))}
              renderDragPreview={group => <GroupDragPreview label={group.label} visible={isVisible(group.key)} />}
            >
              {groups.map((group, index) => (
                <ContentBlock key={group.key} draggableId={group.key} index={index}>
                  {dragHandleProps => (
                    <div className="flex items-center">
                      <span
                        {...dragHandleProps}
                        tabIndex={-1}
                        aria-hidden
                        className={DRAG_HANDLE_CLASS}
                        onClick={event => event.stopPropagation()}
                        onPointerDown={event => event.stopPropagation()}
                      >
                        <GripVertical size={14} aria-hidden />
                      </span>
                      <DropdownMenu.CheckboxItem
                        className="flex-1"
                        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                        onKeyDown={event => moveGroupWithKeyboard(event, group.key)}
                        checked={isVisible(group.key)}
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
