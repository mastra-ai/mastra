import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUpRight, EllipsisVertical, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useId } from 'react';

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
import { SourceIcon, actionIcon } from './BoardIcons';
import { CandidateDetailsPanel } from './CandidateDetailsPanel';

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
    <DropdownMenu.Item key="source" render={<a href={candidate.url} target="_blank" rel="noreferrer" />}>
      <ArrowUpRight aria-hidden />
      <span>{externalLinkLabel(candidate.source)}</span>
    </DropdownMenu.Item>,
  ];

  return (
    <>
      <CardTitleTooltip title={candidate.title}>
        <article
          ref={morph.cardRef}
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
          // Offscreen cards skip layout and paint; an Intake column can hold hundreds.
          className="group border-border1/50 bg-neutral6/5 hover:bg-surface3 relative flex cursor-grab flex-col gap-3 rounded-xl border p-3 transition-colors outline-none [contain-intrinsic-size:auto_7rem] [content-visibility:auto] active:cursor-grabbing"
        >
          <button
            type="button"
            draggable={false}
            aria-label={`Details for ${candidate.title}`}
            aria-expanded={morph.open}
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

      <CandidateDetailsPanel
        candidate={candidate}
        labelledBy={detailsTitleId}
        morph={morph}
        labels={labels}
        projectRepositoryId={projectRepositoryId}
        factoryProjectId={factoryProjectId}
        menu={menuItems}
        defaultAction={defaultAction}
        disabled={disabled}
        runPending={runPending}
        onRun={onRun}
      />
    </>
  );
}
