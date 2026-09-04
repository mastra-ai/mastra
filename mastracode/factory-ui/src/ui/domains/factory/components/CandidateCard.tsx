import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpRight, EllipsisVertical, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { useId } from 'react';

import { useCardMorph } from '../hooks/useCardMorph';
import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import { boardCardStatus } from '../boardCardStatus';
import type { BoardCandidate } from '../boardCandidates';
import { setDragPayload } from '../boardDrag';
import { externalLinkLabel } from '../boardItems';
import type { RunAction } from '../boardRunSpecs';
import { CardActions, CardDetailsHint, REVEAL_ON_CARD_HOVER } from './BoardCardParts';
import { actionIcon } from './BoardIcons';
import { CandidateCardRows } from './CandidateCardRows';
import { CandidateDetailsPanel } from './CandidateDetailsPanel';

// Acting on it is what files the record.
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
        className="group border-border1/50 bg-neutral6/5 hover:bg-surface3 relative flex min-h-36 cursor-grab flex-col gap-3 rounded-3xl border p-2.5 transition-colors outline-none [contain-intrinsic-size:auto_9rem] [content-visibility:auto] active:cursor-grabbing"
      >
        <button
          type="button"
          draggable={false}
          aria-label={`Details for ${candidate.title}`}
          aria-expanded={morph.open}
          className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-3xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={morph.openDetails}
        />
        <CandidateCardRows
          candidate={candidate}
          status={status}
          actions={
            <CardActions
              actions={[
                {
                  label: runPending ? 'Starting…' : defaultAction.label,
                  disabled: disabled || runPending,
                  start: () => onRun(defaultAction),
                },
              ]}
            />
          }
          controls={
            <>
              <CardDetailsHint />
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
            </>
          }
        />
      </article>

      <CandidateDetailsPanel
        candidate={candidate}
        labelledBy={detailsTitleId}
        morph={morph}
        status={status}
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
