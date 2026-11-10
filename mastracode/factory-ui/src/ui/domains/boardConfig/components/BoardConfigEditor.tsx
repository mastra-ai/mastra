import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { BookOpen, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useBlocker, useLocation } from 'react-router';

import type { FactorySkillInfo, StoredBoardResponse } from '../../../../api/types';
import { useResetBoardMutation, useSaveBoardMutation } from '../../../../hooks/useBoardEditor';
import type { BoardRequestError } from '../../../../hooks/useBoardEditor';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import type { FactoryProject } from '../../workspaces/services/github';
import { boardConfigPath, boardSkillsPath, parseBoardConfigPath } from '../boardConfigPaths';
import { useBoardDraft } from '../BoardDraftProvider';
import { draftChanged, phaseHasProblem } from '../boardDraft';
import { BoardAutomationSection } from './BoardAutomationSection';
import { PhaseConfig } from './PhaseConfig';
import type { RuleField } from './PhaseConfig';

/** Rules typed as JSON that don't parse yet, for the page they were typed on. They go when the page does. */
interface RawRuleProblems {
  locationKey: string;
  problems: Partial<Record<RuleField, string>>;
}

function errorText(error: BoardRequestError) {
  return error.conflicts.length > 0 ? error.conflicts.join(' ') : error.message;
}

/**
 * One board's configuration, General page or a phase page. The draft lives here, above both, so moving between a
 * board's pages keeps unsaved edits; leaving the board with edits asks first.
 */
export function BoardConfigEditor({
  factory,
  boardId,
  phaseKey,
  response,
  skills,
  skillsEditable,
  sidebarHidden,
  onReload,
}: {
  factory: FactoryProject;
  boardId: string;
  phaseKey: string | undefined;
  response: StoredBoardResponse;
  skills: FactorySkillInfo[] | undefined;
  skillsEditable: boolean;
  /** On mobile and with the desktop sidebar collapsed the phase list isn't on screen, so the page offers it. */
  sidebarHidden: boolean;
  onReload: () => void;
}) {
  const { board, canEdit } = response;
  const location = useLocation();
  const { draft, setDraft, discard } = useBoardDraft(factory.id, boardId, board);
  const [raw, setRaw] = useState<RawRuleProblems>({ locationKey: location.key, problems: {} });
  const save = useSaveBoardMutation(factory.id, boardId);
  const reset = useResetBoardMutation(factory.id, boardId);

  const readOnly = !canEdit || !board.editable;
  const changed = !readOnly && draftChanged(draft, board);
  const rawProblems = raw.locationKey === location.key ? raw.problems : {};
  const phasesToFix = draft.phases.filter(
    phase => phaseHasProblem(phase) || (phase.key === phaseKey && Object.values(rawProblems).some(Boolean)),
  );
  const stale = save.error?.code === 'revision_mismatch';

  const blocker = useBlocker(({ nextLocation }) => {
    if (!changed) return false;
    const next = parseBoardConfigPath(nextLocation.pathname);
    // The skills page has no save bar, so leaving for it counts as leaving the board's settings.
    return next?.factoryId !== factory.id || next.boardId !== boardId || next.skills === true;
  });

  const phase = phaseKey ? draft.phases.find(candidate => candidate.key === phaseKey) : undefined;
  const generalPath = boardConfigPath(factory.id, boardId);

  let body: ReactNode;
  if (phaseKey && !phase) {
    body = (
      <EmptyState
        titleSlot={<span role="alert">{board.name} has no such phase.</span>}
        actionSlot={
          <Button size="sm" render={<Link to={generalPath} />}>
            Back to general
          </Button>
        }
      />
    );
  } else if (phase) {
    body = (
      <PhaseConfig
        phase={phase}
        phases={draft.phases}
        code={board.codeBehaviour?.[phase.key]}
        skills={skills}
        skillsEditable={skillsEditable}
        factoryId={factory.id}
        boardId={boardId}
        disabled={readOnly}
        onChange={next =>
          setDraft(current => ({
            ...current,
            phases: current.phases.map(candidate => (candidate.key === next.key ? next : candidate)),
          }))
        }
        onRuleProblem={(field, problem) =>
          setRaw(current => ({
            locationKey: location.key,
            problems: { ...(current.locationKey === location.key ? current.problems : {}), [field]: problem },
          }))
        }
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-8">
        {sidebarHidden && (
          <SettingsSubsection title="Phases">
            <SettingsContainer>
              <ul>
                {draft.phases.map(candidate => (
                  <li key={candidate.key}>
                    <Link
                      to={boardConfigPath(factory.id, boardId, candidate.key)}
                      className="hover:bg-fill focus-visible:bg-fill flex items-center gap-3 px-4 py-3 focus-visible:outline-hidden"
                    >
                      <BoardStageIcon stage={candidate.key} kind={phaseIconKind(boardId, candidate.kind)} decorative />
                      <Txt as="span" variant="label" className="min-w-0 flex-1 truncate">
                        {candidate.name}
                      </Txt>
                      <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </SettingsContainer>
          </SettingsSubsection>
        )}
        {sidebarHidden && (
          <SettingsSubsection title="Factory">
            <SettingsContainer>
              <Link
                to={boardSkillsPath(factory.id, boardId)}
                className="hover:bg-fill focus-visible:bg-fill flex items-center gap-3 px-4 py-3 focus-visible:outline-hidden"
              >
                <BookOpen className="text-muted-foreground size-4" aria-hidden />
                <Txt as="span" variant="label" className="min-w-0 flex-1 truncate">
                  Skills
                </Txt>
                <ChevronRight className="text-muted-foreground size-4" aria-hidden />
              </Link>
            </SettingsContainer>
          </SettingsSubsection>
        )}

        {(boardId === 'work' || boardId === 'review') && (
          <BoardAutomationSection
            factoryProjectId={factory.id}
            autoRunEnabled={factory.autoRunEnabled ?? false}
            reviewTestChecksEnabled={factory.reviewTestChecksEnabled ?? false}
            selfReviewEnabled={factory.selfReviewEnabled ?? false}
          />
        )}

        {board.source !== 'stored' && !readOnly && board.revision != null && (
          <SettingsSubsection title="Default">
            <SettingsContainer>
              <SettingsRow label="Reset to default" description="Go back to Factory's version of this board.">
                <AlertDialog>
                  <AlertDialog.Trigger
                    render={
                      <Button size="sm" disabled={reset.isPending}>
                        Reset
                      </Button>
                    }
                  />
                  <AlertDialog.Content>
                    <AlertDialog.Header>
                      <AlertDialog.Title>Reset {board.name} to default?</AlertDialog.Title>
                      <AlertDialog.Description>
                        Every change made to this board's name and phases is replaced with Factory's version.
                      </AlertDialog.Description>
                    </AlertDialog.Header>
                    <AlertDialog.Footer>
                      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                      <AlertDialog.Action onClick={() => reset.mutate(board.revision ?? 0)}>Reset</AlertDialog.Action>
                    </AlertDialog.Footer>
                  </AlertDialog.Content>
                </AlertDialog>
              </SettingsRow>
            </SettingsContainer>
            {reset.error && (
              <Notice variant="destructive" role="alert">
                <Notice.Message>The board was not reset. {errorText(reset.error)}</Notice.Message>
              </Notice>
            )}
          </SettingsSubsection>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-4">
      {!canEdit && <Notice variant="info">Only organization admins can change this board.</Notice>}
      {canEdit && !board.editable && (
        <Notice variant="info">This board is defined in code, so it can't be changed here.</Notice>
      )}
      {!phase && board.problems.length > 0 && (
        <Notice variant="warning" title="This board has problems">
          <Notice.Message>{board.problems.join(' ')}</Notice.Message>
        </Notice>
      )}

      {body}

      {changed && (
        <div className="rounded-card bg-card shadow-overlay dark:bg-muted sticky bottom-4 z-10 flex flex-col gap-3 p-3">
          {stale && (
            <Notice
              variant="warning"
              title="Someone else changed this board"
              action={<Notice.Button onClick={onReload}>Reload</Notice.Button>}
            >
              <Notice.Message>Reload to see their version. Your unsaved changes will be lost.</Notice.Message>
            </Notice>
          )}
          {save.error && !stale && (
            <Notice variant="destructive" role="alert">
              <Notice.Message>The board was not saved. {errorText(save.error)}</Notice.Message>
            </Notice>
          )}
          <div className="flex items-center gap-3">
            <Txt variant="body-sm" tone="muted" className="min-w-0 flex-1" role="status">
              {phasesToFix.length > 0
                ? `Fix ${phasesToFix.map(candidate => candidate.name).join(', ')} to save.`
                : 'Unsaved changes'}
            </Txt>
            <Button size="sm" variant="ghost" disabled={save.isPending} onClick={discard}>
              Discard
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={save.isPending || phasesToFix.length > 0}
              onClick={() =>
                save.mutate({
                  name: draft.name,
                  description: draft.description,
                  phases: draft.phases,
                  expectedRevision: board.revision ?? 0,
                })
              }
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={blocker.state === 'blocked'} onOpenChange={open => !open && blocker.reset?.()}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Discard changes to {board.name}?</AlertDialog.Title>
            <AlertDialog.Description>Your unsaved changes to this board will be lost.</AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
            <Button
              variant="destructive"
              size="md"
              onClick={() => {
                discard();
                blocker.proceed?.();
              }}
            >
              Discard
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}
