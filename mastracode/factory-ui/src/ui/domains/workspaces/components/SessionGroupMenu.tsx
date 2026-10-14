import { ContentBlock, ContentBlocks } from '@mastra/playground-ui/components/ContentBlocks';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { menuItemCheckClass, menuItemClass } from '@mastra/playground-ui/primitives/menu-item';
import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, GripVertical, LayoutGrid } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useRef } from 'react';

import { SESSION_GROUP_BY_LABELS, SESSION_GROUP_BY_OPTIONS } from '../services/sessionGroups';
import type { SessionGroupBy, SessionGroupHeading } from '../services/sessionGroups';

const MOVE_STEP_BY_KEY: Partial<Record<string, -1 | 1>> = { ArrowUp: -1, ArrowDown: 1 };

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
  const groupItems = useRef(new Map<string, HTMLElement>());
  const keys = groups.map(group => group.key);

  const moveGroupWithKeyboard = (event: KeyboardEvent, key: string) => {
    const step = MOVE_STEP_BY_KEY[event.key];
    if (!event.altKey || step === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const from = keys.indexOf(key);
    const to = from + step;
    if (to < 0 || to >= keys.length) return;
    onOrderChange(keys.toSpliced(from, 1).toSpliced(to, 0, key));
    requestAnimationFrame(() => groupItems.current.get(key)?.focus());
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
                        ref={element => {
                          if (element) groupItems.current.set(group.key, element);
                          else groupItems.current.delete(group.key);
                        }}
                        className="flex-1"
                        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                        onKeyDown={event => moveGroupWithKeyboard(event, group.key)}
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
