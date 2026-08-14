import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { ArrowUpRight, EllipsisVertical, PencilLine, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import { boardCardStatus } from '../boardCardStatus';
import type { BoardCandidate } from '../boardCandidates';
import { setDragPayload } from '../boardDrag';
import { externalLinkLabel, metadataLabels } from '../boardItems';
import type { RunAction } from '../boardRunSpecs';
import { CardLabels, CardStatus, CardTitleTooltip, REVEAL_ON_CARD_HOVER, SourceTitle } from './BoardCardParts';
import { SourceIcon, actionIcon } from './BoardIcons';

/**
 * A GitHub/Linear item with no work-item record yet. Same click target, menu
 * and status row as a filed card: acting on it is what creates the record.
 */
export function CandidateCard({
  candidate,
  pendingRunRoles,
  preparing,
  disabled,
  onRun,
  onFile,
}: {
  candidate: BoardCandidate;
  pendingRunRoles: ReadonlyMap<string, FactoryRunPhase | undefined>;
  /** Status text while the click is resolving, before the run mutation starts. */
  preparing?: string;
  disabled: boolean;
  /** Start a run; `prompt` undefined = the action's default prompt. */
  onRun: (action: RunAction, prompt?: string) => void;
  /** File the candidate onto the board without starting a run. */
  onFile: () => void;
}) {
  const anchorRef = useRef<HTMLElement>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState('');

  const labels = metadataLabels(candidate.metadata);
  const [defaultAction] = candidate.runActions;
  const runPending = pendingRunRoles.size > 0 || preparing !== undefined;
  const status = boardCardStatus({
    idle: { label: defaultAction.label, affordance: 'run' },
    runs: candidate.runActions
      .filter(action => pendingRunRoles.has(action.role))
      .map(action => ({ label: action.label, phase: pendingRunRoles.get(action.role) })),
    preparing,
  });

  const closePrompt = () => {
    setPromptOpen(false);
    setPrompt('');
  };

  const runPrompt = () => {
    const trimmed = prompt.trim();
    if (!trimmed || runPending) return;
    closePrompt();
    onRun(defaultAction, trimmed);
  };

  return (
    <CardTitleTooltip title={candidate.title}>
      <article
        ref={anchorRef}
        draggable
        aria-label={candidate.title}
        aria-busy={runPending || undefined}
        data-testid="candidate-card"
        onDragStart={event =>
          setDragPayload(event, {
            kind: 'candidate',
            candidate: {
              source: candidate.source,
              sourceKey: candidate.sourceKey,
              title: candidate.title,
              url: candidate.url,
              metadata: candidate.metadata,
            },
          })
        }
        className="group border-border1/50 bg-neutral6/5 hover:bg-surface3 relative flex cursor-grab flex-col gap-3 rounded-xl border p-3 transition-colors outline-none active:cursor-grabbing"
      >
        {/* Starting the default run is also what files the candidate. */}
        <button
          type="button"
          draggable={false}
          disabled={disabled || runPending}
          aria-busy={runPending || undefined}
          aria-label={`${defaultAction.label} ${candidate.title}`}
          className="focus-visible:outline-accent1 absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed"
          onClick={() => onRun(defaultAction)}
        />
        <div className="absolute top-2 right-2 z-20">
          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  aria-label={`Actions for ${candidate.title}`}
                  className={REVEAL_ON_CARD_HOVER}
                >
                  <EllipsisVertical size={13} aria-hidden />
                </Button>
              }
            />
            <DropdownMenu.Content align="end" className="min-w-44">
              {candidate.runActions.map(action => (
                <DropdownMenu.Item key={action.label} disabled={runPending} onClick={() => onRun(action)}>
                  {actionIcon(action.label)}
                  <span>{pendingRunRoles.has(action.role) ? 'Starting…' : action.label}</span>
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Item disabled={runPending} onClick={() => setPromptOpen(true)}>
                <PencilLine aria-hidden />
                <span>Custom prompt…</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item render={<a href={candidate.url} target="_blank" rel="noreferrer" />}>
                <ArrowUpRight aria-hidden />
                <span>{externalLinkLabel(candidate.source)}</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={onFile}>
                <Plus aria-hidden />
                <span>Add to board</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-ui-xs text-icon2 truncate pr-8">{candidate.meta}</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <SourceIcon source={candidate.source} />
            <span className="text-ui-smd text-icon6 min-w-0 flex-1 truncate font-semibold">
              <SourceTitle source={candidate.source} title={candidate.title} />
            </span>
          </div>
        </div>
        <CardLabels labels={labels} />
        <CardStatus status={status} />
        <Popover open={promptOpen} onOpenChange={open => (open ? setPromptOpen(true) : closePrompt())}>
          <PopoverContent anchor={anchorRef} align="end" className="w-80 p-3">
            <form
              aria-label={`Custom prompt for ${candidate.title}`}
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
                aria-label={`Prompt for ${candidate.title}`}
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
                <Button type="submit" size="xs" disabled={runPending || !prompt.trim()}>
                  Run
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </article>
    </CardTitleTooltip>
  );
}
