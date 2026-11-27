import { Ellipsis } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Switch } from '@/ds/components/Switch';
import { Txt } from '@/ds/components/Txt';
import { IconCircleDashed } from '@/ds/icons/central/IconCircleDashed';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { cn } from '@/utils/cn';

/** The rule's trigger, name as the panel's title, switch and menu; a new rule says so until it has somewhere to go. */
export function RuleHeader({
  rule,
  boardName,
  icon: Icon,
  name,
  maxNameLength,
  readOnly,
  pending,
  onClose,
  onRename,
  onToggle,
  onDelete,
}: {
  /** The saved rule; undefined for a new one. */
  rule: { name: string; enabled: boolean } | undefined;
  /** The rule's own board's name. */
  boardName: string;
  icon: LucideIcon | undefined;
  /** Undefined while a new rule has no phase yet, so nothing to name. */
  name: string | undefined;
  maxNameLength: number;
  readOnly: boolean;
  /** A change to the rules is saving: the switch waits, as it saves against the version it will replace. */
  pending: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon ? (
        <Icon className="mt-1 size-icon-xs shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <IconCircleDashed className="mt-1 size-icon-xs shrink-0 text-muted-foreground" aria-hidden />
      )}
      {name === undefined ? (
        <>
          <Txt as="h2" variant="card-title-strong" className="min-w-0 flex-1 truncate">
            New rule
          </Txt>
          <Txt as="span" variant="caption" tone="muted" className="shrink-0">
            {boardName}
          </Txt>
        </>
      ) : readOnly ? (
        <Txt as="h2" variant="card-title-strong" className="min-w-0 flex-1 break-words">
          {name}
        </Txt>
      ) : (
        // The name is one line of text that wraps like the title it is: Enter doesn't break it.
        <textarea
          aria-label="Name"
          value={name}
          maxLength={maxNameLength}
          rows={1}
          className={cn(
            'field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-card-title-strong zoom-safe-text text-foreground outline-hidden',
            rule
              ? '-mx-1 -my-0.5 rounded-lg px-1 py-0.5 hover:bg-fill-subtle focus:bg-fill-subtle'
              : '-my-1.5 rounded-xl bg-fill-subtle px-2.5 py-1.5',
          )}
          onKeyDown={event => event.key === 'Enter' && event.preventDefault()}
          onChange={change => onRename(change.target.value.replace(/\n/g, ' '))}
        />
      )}
      {rule && !readOnly && (
        <>
          <Switch aria-label={`${rule.name} on`} checked={rule.enabled} disabled={pending} onCheckedChange={onToggle} />
          <DropdownMenu>
            <DropdownMenu.Trigger variant="ghost" size="icon-sm" tooltip="More" aria-label="More">
              <Ellipsis />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item variant="destructive" onClick={onDelete}>
                Delete rule
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </>
      )}
      <Button variant="ghost" size="icon-sm" tooltip="Close" aria-label="Close" onClick={onClose}>
        <IconCrossMedium />
      </Button>
    </div>
  );
}
