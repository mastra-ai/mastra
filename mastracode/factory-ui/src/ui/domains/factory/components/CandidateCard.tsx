import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUpRight, EllipsisVertical, PencilLine, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';

import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import { boardCardStatus } from '../boardCardStatus';
import type { BoardCandidate } from '../boardCandidates';
import { setDragPayload } from '../boardDrag';
import { externalLinkLabel, metadataLabels } from '../boardItems';
import type { RunAction } from '../boardRunSpecs';
import { CardDetailsHint, CardLabels, CardStatus, CardTitleTooltip, REVEAL_ON_CARD_HOVER, SourceTitle } from './BoardCardParts';
import { CardSourceDescription } from './BoardCardDetails';
import { SourceIcon, actionIcon } from './BoardIcons';
import { morph } from '../../../lib/morphTransition';

/**
 * A GitHub/Linear item with no work-item record yet. Acting on it is what
 * creates the record: clicking opens its details, running files it.
 */
export function CandidateCard({
  candidate,
  projectRepositoryId,
  pendingRunRoles,
  preparing,
  disabled,
  onRun,
  onFile,
}: {
  candidate: BoardCandidate;
  /** Repository id resolving GitHub descriptions in the detail dialog. */
  projectRepositoryId: string;
  pendingRunRoles: ReadonlyMap<string, FactoryRunPhase | undefined>;
  /** Status text while a run trigger is resolving, before the run mutation starts. */
  preparing?: string;
  disabled: boolean;
  /** Start a run; `prompt` undefined = the action's default prompt. */
  onRun: (action: RunAction, prompt?: string) => void;
  /** File the candidate onto the board without starting a run. */
  onFile: () => void;
}) {
  const promptAnchorRef = useRef<HTMLButtonElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  // Unique per card instance — the view-transition name pairs this exact card
  // with its dialog while one of them is on screen.
  const morphName = `board-card-${candidate.sourceKey}`;
  const openDetails = () => morph(() => setDetailsOpen(true));
  const closeDetails = () => morph(() => setDetailsOpen(false));

  const labels = metadataLabels(candidate.metadata);
  const number = typeof candidate.metadata.number === 'number' ? candidate.metadata.number : undefined;
  const [defaultAction] = candidate.runActions;
  const runPending = pendingRunRoles.size > 0 || preparing !== undefined;
  const status = boardCardStatus({
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
    closeDetails();
    onRun(defaultAction, trimmed);
  };

  const startDefaultRun = () => {
    closeDetails();
    onRun(defaultAction);
  };

  const fileFromDialog = () => {
    closeDetails();
    onFile();
  };

  const menuItems: ReactElement[] = [
    ...candidate.runActions.map(action => (
      <DropdownMenu.Item
        key={action.label}
        disabled={runPending}
        onClick={() => {
          closeDetails();
          onRun(action);
        }}
      >
        {actionIcon(action.label)}
        <span>{pendingRunRoles.has(action.role) ? 'Starting…' : action.label}</span>
      </DropdownMenu.Item>
    )),
    <DropdownMenu.Item key="file" disabled={runPending} onClick={onFile}>
      <Plus aria-hidden />
      <span>Add to board</span>
    </DropdownMenu.Item>,
  ];

  return (
    <>
      <CardTitleTooltip title={candidate.title}>
        <article
          draggable
          aria-expanded={detailsOpen}
          aria-label={candidate.title}
          aria-busy={runPending || undefined}
          data-testid="candidate-card"
          style={{ viewTransitionName: detailsOpen ? undefined : morphName }}
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
          <button
            type="button"
            draggable={false}
            aria-label={`Details for ${candidate.title}`}
            className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={openDetails}
          />
          <div className="absolute top-2 right-2 z-20">
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${candidate.title}`}
                    className={REVEAL_ON_CARD_HOVER}
                  >
                    <EllipsisVertical size={13} aria-hidden />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end" className="min-w-44">
                {menuItems}
                <DropdownMenu.Item render={<a href={candidate.url} target="_blank" rel="noreferrer" />}>
                  <ArrowUpRight aria-hidden />
                  <span>{externalLinkLabel(candidate.source)}</span>
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
              {/* Triage reads the source before deciding, so keep it one click away. */}
              <a
                href={candidate.url}
                target="_blank"
                rel="noreferrer"
                draggable={false}
                aria-label={externalLinkLabel(candidate.source)}
                className={cn('text-icon3 hover:text-icon5 relative shrink-0', REVEAL_ON_CARD_HOVER)}
              >
                <ArrowUpRight size={12} aria-hidden />
              </a>
            </div>
          </div>
          <CardLabels labels={labels} />
          <CardStatus status={status} />
          {status.kind === 'idle' && (
            <CardDetailsHint className="pointer-events-none pointer-fine:absolute pointer-fine:right-3 pointer-fine:bottom-3 pointer-fine:z-20 pointer-fine:ml-0" />
          )}
        </article>
      </CardTitleTooltip>

      <Dialog open={detailsOpen} onOpenChange={open => !open && closeDetails()}>
        <DialogContent style={{ viewTransitionName: morphName }} className="board-details-dialog max-w-2xl">
          <DialogHeader className="gap-1.5 border-b border-border1/40 px-5 pt-4 pb-4">
            <div className="flex min-w-0 items-center gap-1.5 pr-8">
              <SourceIcon source={candidate.source} />
              <span className="text-ui-xs text-icon2 min-w-0 truncate">{candidate.meta}</span>
            </div>
            <DialogTitle className="text-ui-lg text-icon6 font-semibold wrap-anywhere">{candidate.title}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 px-5 py-4">
            <CardLabels labels={labels} />
            <CardSourceDescription
              source={candidate.source}
              projectRepositoryId={projectRepositoryId}
              number={number}
            />
          </DialogBody>
          <DialogFooter className="justify-between gap-2 border-t border-border1/40 px-5 py-3 sm:flex-row sm:items-center">
            <Button type="button" variant="primary" size="sm" disabled={disabled || runPending} onClick={startDefaultRun}>
              {defaultAction.label}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                ref={promptAnchorRef}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPromptOpen(true)}
              >
                <PencilLine size={13} aria-hidden />
                Custom prompt…
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={runPending} onClick={fileFromDialog}>
                <Plus size={13} aria-hidden />
                Add to board
              </Button>
            </div>
            <Popover open={promptOpen} onOpenChange={open => (open ? setPromptOpen(true) : closePrompt())}>
              <PopoverContent anchor={promptAnchorRef} align="end" className="w-80 p-3">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
