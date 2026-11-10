import { Badge } from '@mastra/playground-ui/components/Badge';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import type { ReactNode } from 'react';

import type { StoredBoardResponse, StoredPhaseInfo } from '../../../../api/types';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { useBoardDraft } from '../BoardDraftProvider';
import { InlineText } from './InlineText';
import { cn } from '@mastra/playground-ui/utils/cn';

const KINDS: Record<StoredPhaseInfo['kind'], { label: string; meaning: string }> = {
  resting: { label: 'Resting', meaning: 'No agent works here. Cards wait for a person or an event to move them.' },
  working: { label: 'Working', meaning: 'An agent works on each card here, following the steps below.' },
  terminal: { label: 'Terminal', meaning: 'Cards are finished here. Their agent sessions stop.' },
};

/** A short label that explains itself on hover or focus. */
function Explained({ label, meaning, children }: { label: string; meaning: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            tabIndex={0}
            aria-label={`${label}. ${meaning}`}
            className={cn('inline-flex rounded-sm', focusRing)}
          >
            {children}
          </span>
        }
      />
      <TooltipContent side="bottom" className="max-w-72">
        {meaning}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The open page's own fields, edited in place: the board's name and revision on General, or the phase's
 * name, kind and description on a phase page.
 */
export function BoardConfigHeader({
  factoryId,
  boardId,
  phaseKey,
  response,
}: {
  factoryId: string;
  boardId: string;
  phaseKey: string | undefined;
  response: StoredBoardResponse;
}) {
  const { board, canEdit } = response;
  const readOnly = !canEdit || !board.editable;
  const { draft, setDraft } = useBoardDraft(factoryId, boardId, board);
  const phase = phaseKey ? draft.phases.find(candidate => candidate.key === phaseKey) : undefined;
  if (phaseKey && !phase) return null;

  const setPhase = (patch: Partial<StoredPhaseInfo>) =>
    setDraft(current => ({
      ...current,
      phases: current.phases.map(candidate => (candidate.key === phaseKey ? { ...candidate, ...patch } : candidate)),
    }));
  const name = phase ? phase.name : draft.name;
  const description = phase?.description ?? '';

  return (
    <PageHeader>
      {/* The icon sits in the title row, so the icon, the description and the sections below share one left edge. */}
      <PageHeader.Title className="gap-2.5">
        {phase && <BoardStageIcon stage={phase.key} kind={phaseIconKind(boardId, phase.kind)} decorative />}
        <InlineText
          value={name}
          label={phase ? 'Phase name' : 'Board name'}
          required
          readOnly={readOnly}
          variant="heading"
          tone="ink"
          onChange={next => (phase ? setPhase({ name: next }) : setDraft(current => ({ ...current, name: next })))}
        />
      </PageHeader.Title>
      {(phase || board.revision != null) && (
        <PageHeader.Meta beside>
          {phase ? (
            <Explained label={KINDS[phase.kind].label} meaning={KINDS[phase.kind].meaning}>
              <Badge>{KINDS[phase.kind].label}</Badge>
            </Explained>
          ) : (
            <Explained
              label={`Revision ${board.revision}`}
              meaning="Goes up each time the board is saved. If someone else saves first, you're asked to reload before saving."
            >
              Revision {board.revision}
            </Explained>
          )}
        </PageHeader.Meta>
      )}
      {phase && (description || !readOnly) && (
        <PageHeader.Description>
          <InlineText
            value={description}
            label="Phase description"
            placeholder="Add a description"
            multiline
            readOnly={readOnly}
            variant="caption"
            tone="muted"
            className="zoom-safe-text w-full"
            onChange={next => setPhase({ description: next || null })}
          />
        </PageHeader.Description>
      )}
    </PageHeader>
  );
}
