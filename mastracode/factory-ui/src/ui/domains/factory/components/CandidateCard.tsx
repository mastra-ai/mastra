import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUpRight, EllipsisVertical, Minimize2, PencilLine, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useId, useRef, useState } from 'react';

import { useCardMorph } from '../hooks/useCardMorph';
import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import { boardCardStatus } from '../boardCardStatus';
import type { BoardCandidate } from '../boardCandidates';
import { setDragPayload } from '../boardDrag';
import { externalLinkLabel, metadataLabels } from '../boardItems';
import type { RunAction } from '../boardRunSpecs';
import {
  CardDetailsHint,
  CardLabels,
  CardStatus,
  CardTitleTooltip,
  REVEAL_ON_CARD_HOVER,
  SourceTitle,
} from './BoardCardParts';
import { CardSourceDescription } from './BoardCardDetails';
import { SourceIcon, actionIcon } from './BoardIcons';
import { CardDetailsBody, CardDetailsPanel } from './CardDetailsPanel';

/**
 * A GitHub/Linear item with no work-item record yet. Acting on it is what
 * creates the record: clicking opens its details, running files it.
 */
export function CandidateCard({
  candidate,
  projectRepositoryId,
  factoryProjectId,
  pendingRunRoles,
  preparing,
  disabled,
  onRun,
  onFile,
}: {
  candidate: BoardCandidate;
  /** Repository id resolving GitHub descriptions in the detail panel. */
  projectRepositoryId: string;
  /** Factory project id resolving Linear descriptions in the detail panel. */
  factoryProjectId: string;
  pendingRunRoles: ReadonlyMap<string, FactoryRunPhase | undefined>;
  /** Status text while a run trigger is resolving, before the run mutation starts. */
  preparing?: string;
  disabled: boolean;
  /** Start a run; `prompt` undefined = the action's default prompt. */
  onRun: (action: RunAction, prompt?: string) => void;
  /** File the candidate onto the board without starting a run. */
  onFile: () => void;
}) {
  const detailsTitleId = useId();
  const promptAnchorRef = useRef<HTMLButtonElement>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const morph = useCardMorph();

  const labels = metadataLabels(candidate.metadata);
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
    morph.closeDetails();
    onRun(defaultAction, trimmed);
  };

  const startDefaultRun = () => {
    morph.closeDetails();
    onRun(defaultAction);
  };

  const fileFromDetails = () => {
    morph.closeDetails();
    onFile();
  };

  const menuItems: ReactElement[] = [
    ...candidate.runActions.map(action => (
      <DropdownMenu.Item
        key={action.label}
        disabled={runPending}
        onClick={() => {
          morph.closeDetails();
          onRun(action);
        }}
      >
        {actionIcon(action.label)}
        <span>{pendingRunRoles.has(action.role) ? 'Starting…' : action.label}</span>
      </DropdownMenu.Item>
    )),
    <DropdownMenu.Item key="file" disabled={runPending} onClick={fileFromDetails}>
      <Plus aria-hidden />
      <span>Add to board</span>
    </DropdownMenu.Item>,
  ];

  return (
    <>
      <CardTitleTooltip title={candidate.title}>
        <article
          ref={morph.cardRef}
          draggable
          aria-expanded={morph.open}
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
          // Offscreen cards skip layout and paint; an Intake column can hold hundreds.
          className="group border-border1/50 bg-neutral6/5 hover:bg-surface3 relative flex cursor-grab flex-col gap-3 rounded-xl border p-3 transition-colors outline-none [contain-intrinsic-size:auto_7rem] [content-visibility:auto] active:cursor-grabbing"
        >
          <button
            type="button"
            draggable={false}
            aria-label={`Details for ${candidate.title}`}
            className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={morph.openDetails}
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

      <CardDetailsPanel morph={morph} labelledBy={detailsTitleId}>
        {/* The card's own rows, in the card's own order, spacing and padding:
            what the card already showed is where it already was, so the box
            grows around it instead of re-staging it. */}
        <div className="flex flex-col gap-3 p-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-ui-xs text-icon2 min-w-0 flex-1 truncate">{candidate.meta}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Collapse ${candidate.title}`}
                onClick={morph.closeDetails}
              >
                <Minimize2 size={13} aria-hidden />
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`All actions for ${candidate.title}`}
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
            <div className="flex min-w-0 items-center gap-1.5">
              <SourceIcon source={candidate.source} />
              <h2 id={detailsTitleId} className="text-ui-smd text-icon6 m-0 min-w-0 font-semibold wrap-anywhere">
                {candidate.title}
              </h2>
            </div>
          </div>
          <CardLabels labels={labels} />
        </div>
        {/* Only what the card never carried is staged in. */}
        <CardDetailsBody>
          <CardSourceDescription
            item={candidate}
            projectRepositoryId={projectRepositoryId}
            factoryProjectId={factoryProjectId}
          />
        </CardDetailsBody>
        <div className="flex flex-col gap-2 px-3 py-2.5" data-card-morph="reveal">
          <Button
            ref={promptAnchorRef}
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setPromptOpen(true)}
          >
            <PencilLine size={13} aria-hidden />
            Custom prompt…
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full"
            disabled={disabled || runPending}
            onClick={startDefaultRun}
          >
            {defaultAction.label}
          </Button>
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
        </div>
      </CardDetailsPanel>
    </>
  );
}
