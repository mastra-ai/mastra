import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { ChevronDown, Play } from 'lucide-react';
import { useRef, useState } from 'react';

export interface FactoryItemActionsProps {
  /** Default action label, e.g. `Investigate` or `Review`. */
  actionLabel: string;
  /** Human label for the item used in aria labels, e.g. `issue #12`. */
  itemLabel: string;
  /** True while this item's run is being started. */
  starting: boolean;
  /** Disables both the default action and the menu. */
  disabled: boolean;
  /** Run the default skill action (Investigate / Review). */
  onAction: () => void;
  /** Run a custom prompt typed by the user (already trimmed, non-empty). */
  onRunPrompt: (prompt: string) => void;
}

/**
 * Action cluster for a Factory Intake/Review row: a one-click default action
 * (Investigate / Review) plus a menu that also offers "Custom prompt…", which
 * opens a small popover where the user types what they want the agent to do
 * with the item instead of the default skill run.
 */
export function FactoryItemActions({
  actionLabel,
  itemLabel,
  starting,
  disabled,
  onAction,
  onRunPrompt,
}: FactoryItemActionsProps) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);

  const closePrompt = () => {
    setPromptOpen(false);
    setPrompt('');
  };

  const runPrompt = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    closePrompt();
    onRunPrompt(trimmed);
  };

  return (
    <div ref={anchorRef} className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${actionLabel} ${itemLabel}`}
        disabled={disabled}
        onClick={onAction}
      >
        <Play size={13} aria-hidden />
        {starting ? 'Starting…' : actionLabel}
      </Button>
      <DropdownMenu>
        <DropdownMenu.Trigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`More actions for ${itemLabel}`}
              disabled={disabled}
            >
              <ChevronDown size={13} aria-hidden />
            </Button>
          }
        />
        <DropdownMenu.Content align="end" className="min-w-40">
          <DropdownMenu.Item onClick={onAction}>{actionLabel}</DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => setPromptOpen(true)}>Custom prompt…</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      <Popover open={promptOpen} onOpenChange={open => (open ? setPromptOpen(true) : closePrompt())}>
        <PopoverContent anchor={anchorRef} align="end" className="w-80 p-3">
          <form
            aria-label={`Custom prompt for ${itemLabel}`}
            className="flex flex-col gap-2"
            onSubmit={event => {
              event.preventDefault();
              runPrompt();
            }}
          >
            <Textarea
              autoFocus
              rows={3}
              size="sm"
              value={prompt}
              placeholder="What should the agent do with this?"
              aria-label={`Prompt for ${itemLabel}`}
              onChange={event => setPrompt(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  runPrompt();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="xs" onClick={closePrompt}>
                Cancel
              </Button>
              <Button type="submit" size="xs" disabled={!prompt.trim()}>
                Run
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
