import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';
import { Ellipsis } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../../api/types';
import { boardName } from '../../../boardRules/ruleTargets';
import { MAX_RULE_NAME } from '../../ruleDraft';

/** The rule's trigger, name as the panel's title, switch and menu; a new rule says so until it has somewhere to go. */
export function RuleHeader({
  rule,
  board,
  icon: Icon,
  name,
  readOnly,
  pending,
  onClose,
  onRename,
  onToggle,
  onDelete,
}: {
  rule: IntakeRouteInfo | undefined;
  board: InstalledBoardInfo;
  icon: LucideIcon | undefined;
  /** Undefined while a new rule has no phase yet, so nothing to name. */
  name: string | undefined;
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
        <Icon className="text-muted-foreground size-icon-xs mt-1 shrink-0" aria-hidden />
      ) : (
        <IconCircleDashed className="text-muted-foreground size-icon-xs mt-1 shrink-0" aria-hidden />
      )}
      {name === undefined ? (
        <>
          <Txt as="h2" variant="card-title-strong" className="min-w-0 flex-1 truncate">
            New rule
          </Txt>
          <Txt as="span" variant="caption" tone="muted" className="shrink-0">
            {boardName(board)}
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
          maxLength={MAX_RULE_NAME}
          rows={1}
          className={cn(
            'text-card-title-strong text-foreground zoom-safe-text field-sizing-content min-w-0 flex-1 resize-none bg-transparent outline-hidden',
            rule
              ? 'hover:bg-fill-subtle focus:bg-fill-subtle -mx-1 -my-0.5 rounded-lg px-1 py-0.5'
              : 'bg-fill-subtle -my-1.5 rounded-xl px-2.5 py-1.5',
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
