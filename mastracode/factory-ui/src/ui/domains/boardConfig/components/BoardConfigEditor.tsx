import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router';

import { queryKeys } from '../../../../api/keys';
import type { BoardCatalogResponse, FactorySkillInfo, StoredBoardResponse } from '../../../../api/types';
import { useQueryClient } from '@tanstack/react-query';
import { useSaveBoardMutation } from '../../../../hooks/useBoardEditor';
import { SettingsSubsection } from '../../settings/components/SettingsSubsection';
import type { FactoryProject } from '../../workspaces/services/github';
import { boardConfigPath, boardSkillsPath, parseBoardConfigPath } from '../boardConfigPaths';
import { useBoardDraft } from '../BoardDraftProvider';
import { canRemovePhase, draftChanged, phaseHasProblem, rawRuleKey, removePhase, withAutoStart } from '../boardDraft';
import type { RuleField } from '../boardDraft';
import { SettingsColumn } from './SettingsColumn';
import { BoardOverview } from './BoardOverview';
import { AddPhaseButton } from './AddPhaseButton';
import { PhaseConfig } from './PhaseConfig';
import { IconBook } from '@mastra/playground-ui/icons/central/IconBook';
import { IconChevronRightMedium } from '@mastra/playground-ui/icons/central/IconChevronRightMedium';

const RULE_FIELDS: RuleField[] = ['autoStartWhen', 'autoApproveWhen'];

/**
 * One board's configuration, Overview page or a phase page. The draft lives here, above both, so moving between a
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
  const { draft, rawRules, locked, setDraft, setRawRule, discard } = useBoardDraft(factory.id, boardId, board);
  // Rule editors read their rule once, so a discard or a new revision gives the phase page fresh ones.
  const [discards, setDiscards] = useState(0);
  const discardEdits = () => {
    discard();
    setDiscards(count => count + 1);
  };
  const navigate = useNavigate();
  const save = useSaveBoardMutation(factory.id, boardId);
  const queryClient = useQueryClient();

  const readOnly = !canEdit || !board.editable;
  const phase = phaseKey ? draft.phases.find(candidate => candidate.key === phaseKey) : undefined;
  // Condition rows live in the phase page's editors, so a half-filled row only counts until that page closes.
  const phasePage = phase && `${phase.key}:${board.revision ?? 'code'}:${discards}`;
  const [unfinished, setUnfinished] = useState<{ page: string | undefined; fields: RuleField[] }>({
    page: phasePage,
    fields: [],
  });
  if (unfinished.page !== phasePage) setUnfinished({ page: phasePage, fields: [] });
  const unfinishedFields = unfinished.page === phasePage ? unfinished.fields : [];
  const markUnfinished = (field: RuleField, value: boolean) =>
    setUnfinished(current => {
      const fields = current.fields.filter(other => other !== field);
      return { ...current, fields: value ? [...fields, field] : fields };
    });
  // JSON typed into a rule editor, or a half-filled condition, counts as an edit: leaving would lose it.
  const changed =
    !readOnly && (draftChanged(draft, board) || Object.keys(rawRules).length > 0 || unfinishedFields.length > 0);
  const phasesToFix = draft.phases.filter(
    candidate => phaseHasProblem(candidate, rawRules) || (candidate === phase && unfinishedFields.length > 0),
  );
  const nameMissing = draft.name.trim() === '';
  const stale = save.error?.code === 'revision_mismatch';

  const blocker = useBlocker(({ nextLocation }) => {
    // A deleted board leaves the catalog before its header navigates away: there is nothing left to save.
    const listed = queryClient
      .getQueryData<BoardCatalogResponse>(queryKeys.boardCatalog(factory.id))
      ?.boards.some(other => other.id === boardId);
    if (!changed || listed === false) return false;
    const next = parseBoardConfigPath(nextLocation.pathname);
    // The skills, rules and intake pages have no save bar, so leaving for them counts as leaving the board's settings.
    return (
      next?.factoryId !== factory.id ||
      next.boardId !== boardId ||
      next.skills === true ||
      next.rules === true ||
      next.intake === true
    );
  });

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
        // Each phase gets its own editors, so state one phase's editors hold never shows on another's page.
        key={phasePage}
        phase={phase}
        phases={draft.phases}
        requiredNextPhases={board.codeBehaviour?.[phase.key]?.requiredNextPhases ?? []}
        skills={skills}
        skillsEditable={skillsEditable}
        factoryId={factory.id}
        boardId={boardId}
        disabled={readOnly || locked}
        rawRules={{
          autoStartWhen: rawRules[rawRuleKey(phase.key, 'autoStartWhen')],
          autoApproveWhen: rawRules[rawRuleKey(phase.key, 'autoApproveWhen')],
        }}
        onRawRule={(field, text) => {
          setRawRule(rawRuleKey(phase.key, field), text);
          // The rows go away for JSON or a switched-off rule, and come back built from the last whole rule.
          markUnfinished(field, false);
        }}
        onUnfinished={markUnfinished}
        onRemove={
          readOnly || locked || !canRemovePhase(draft.phases, phase.key, board.codeBehaviour)
            ? undefined
            : () => {
                for (const field of RULE_FIELDS) setRawRule(rawRuleKey(phase.key, field), undefined);
                setDraft(current => ({ ...current, phases: removePhase(current.phases, phase.key) }));
                void navigate(generalPath);
              }
        }
        onChange={next =>
          setDraft(current => ({
            ...current,
            phases: current.phases.map(candidate => (candidate.key === next.key ? next : candidate)),
          }))
        }
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-8">
        <BoardOverview
          factoryId={factory.id}
          boardId={boardId}
          phases={draft.phases}
          skills={skills}
          onAutoStart={
            readOnly || locked
              ? undefined
              : (phaseKey, on) => {
                  setDraft(current => ({
                    ...current,
                    phases: current.phases.map(phase => (phase.key === phaseKey ? withAutoStart(phase, on) : phase)),
                  }));
                  if (!on) setRawRule(rawRuleKey(phaseKey, 'autoStartWhen'), undefined);
                }
          }
          action={
            sidebarHidden && !readOnly ? (
              <AddPhaseButton factoryId={factory.id} boardId={boardId} board={board} disabled={locked} />
            ) : undefined
          }
        />
        <SettingsColumn pinned className="flex flex-col gap-8 empty:hidden">
          {sidebarHidden && (
            <SettingsSubsection title="Factory">
              <SettingsContainer>
                <Link
                  to={boardSkillsPath(factory.id, boardId)}
                  className="hover:bg-fill focus-visible:bg-fill flex items-center gap-3 px-4 py-3 focus-visible:outline-hidden"
                >
                  <IconBook className="text-muted-foreground size-icon-md" aria-hidden />
                  <Txt as="span" variant="label" className="min-w-0 flex-1 truncate">
                    Skills
                  </Txt>
                  <IconChevronRightMedium className="text-muted-foreground size-icon-md" aria-hidden />
                </Link>
              </SettingsContainer>
            </SettingsSubsection>
          )}
        </SettingsColumn>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-8 pb-4', !phase && 'w-max min-w-full')}>
      {!board.editable ? (
        <SettingsColumn pinned={!phase}>
          <Notice variant="info">This board is defined in code, so it can't be changed here.</Notice>
        </SettingsColumn>
      ) : (
        !canEdit && (
          <SettingsColumn pinned={!phase}>
            <Notice variant="info">Only organization admins can change this board.</Notice>
          </SettingsColumn>
        )
      )}
      {!phase && board.problems.length > 0 && (
        <SettingsColumn pinned>
          <Notice variant="warning" title="This board has problems">
            <Notice.Message>{board.problems.join(' ')}</Notice.Message>
          </Notice>
        </SettingsColumn>
      )}

      {body}

      {changed && (
        <SettingsColumn
          pinned={!phase}
          sticky
          className="rounded-card bg-card shadow-overlay dark:bg-muted flex flex-col gap-3 p-3"
        >
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
              <Notice.Message>The board was not saved. {save.error.reasons}</Notice.Message>
            </Notice>
          )}
          <div className="flex items-center gap-3">
            <Txt variant="body-sm" tone="muted" className="min-w-0 flex-1" role="status">
              {nameMissing
                ? 'Name the board to save.'
                : phasesToFix.length > 0
                  ? `Fix ${phasesToFix.map(candidate => candidate.name || candidate.key).join(', ')} to save.`
                  : 'Unsaved changes'}
            </Txt>
            <Button size="sm" variant="ghost" disabled={save.isPending} onClick={discardEdits}>
              Discard
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={save.isPending || nameMissing || phasesToFix.length > 0}
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
        </SettingsColumn>
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
