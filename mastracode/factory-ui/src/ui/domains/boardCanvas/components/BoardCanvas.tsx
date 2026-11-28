import { factoryKeys, useSaveBoardMutation, useIntakeTestQuery } from '@mastra/react/hooks/factory';
import {
  CanvasFrame,
  CanvasToolbar,
  DraftBar,
  LeaveDialog,
  TestInput,
  usePhoneLayout,
  draftChanged,
  movePhase,
  phaseHasProblem,
  removePhase,
  withNextPhases,
  boardName,
} from '@mastra/playground-ui/domains/factory';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { BoardCatalogResponse, StoredBoardResponse } from '@internal/factory-contract';
import type { StoredPhaseInfo, BoardDraft, RuleEvent } from '@mastra/playground-ui/domains/factory';
import { useBoardDraft } from '../../boardConfig/BoardDraftProvider';
import { useBoardSettingsHost } from '../boardSettingsHost';
import { readCanvasFocus } from '../canvasFocus';
import type { CanvasFocus } from '../canvasFocus';
import { canvasModel, emphasisOf, orderNote } from '../canvasModel';
import type { RuleLine } from '../canvasModel';
import { useCanvasData } from '../useCanvasData';
import { useUnfinishedFields } from '../useUnfinishedFields';
import { useBoardActions } from './BoardActions';
import { BoardHeader } from './BoardHeader';
import { BoardSettingsTabs } from './BoardSettingsTabs';
import { CanvasPanel } from './CanvasPanel';
import { OtherBoards } from './OtherBoards';
import { PhaseFlow } from './PhaseFlow';

/** Why the draft can't be saved yet, or undefined when it can. */
function saveHold(draft: BoardDraft, toFix: readonly StoredPhaseInfo[]): string | undefined {
  if (draft.name.trim() === '') return 'Name the board to save.';
  if (toFix.length === 0) return undefined;
  return `Fix ${toFix.map(candidate => candidate.name || candidate.key).join(', ')} to save.`;
}

/**
 * One board's settings as a canvas: the board's name as the page's title, its phases top to bottom with the rules into
 * each, and a side panel for a phase, a rule or a test. The board's edits share one draft and save together; rules
 * save from their panel.
 */
export function BoardCanvas({
  factoryId,
  boardId,
  phaseKey,
  response,
  onReload,
}: {
  factoryId: string;
  boardId: string;
  phaseKey: string | undefined;
  response: StoredBoardResponse;
  onReload: () => void;
}) {
  const { board, canEdit = false } = response;
  const { draft, locked, setDraft, discard } = useBoardDraft(factoryId, boardId, board);
  const data = useCanvasData(factoryId, boardId);
  const host = useBoardSettingsHost();
  const focus = readCanvasFocus(host.searchParams);
  const queryClient = useQueryClient();
  const save = useSaveBoardMutation(factoryId, boardId);
  const writes = useBoardActions({ factoryId, boardId, boards: data.boards, onDeleted: discard });
  const phone = usePhoneLayout();
  // Rule editors read their rule once, so a discard gives the phase panel fresh ones.
  const [discards, setDiscards] = useState(0);
  const [lane, setLane] = useState<RuleEvent>();

  const readOnly = !canEdit || !board.editable;
  const frozen = readOnly || locked;
  const phase = phaseKey ? draft.phases.find(candidate => candidate.key === phaseKey) : undefined;
  const title = draft.name || board.name;
  const open = (nextPhase?: string, nextFocus?: CanvasFocus) =>
    host.navigate(host.configHref(boardId, nextPhase, nextFocus));

  // Condition rows live in the phase panel's editors, so a half-filled row only counts until that panel closes. The
  // panel moves between a dock and a phone's sheet across the breakpoint, which remounts its editors empty.
  const phasePage = phase && `${phase.key}:${board.revision ?? 'code'}:${discards}:${phone ? 'phone' : 'wide'}`;
  const unfinished = useUnfinishedFields(phasePage);

  // A half-filled condition counts as an edit: leaving would lose it.
  const changed = !readOnly && (draftChanged(draft, board) || unfinished.fields.length > 0);
  const toFix = draft.phases.filter(
    candidate => phaseHasProblem(candidate) || (candidate === phase && unfinished.fields.length > 0),
  );
  const hold = saveHold(draft, toFix);
  const stale = save.error?.code === 'revision_mismatch';

  const leaveGuard = host.useLeaveGuard(boardId, () => {
    // A deleted board leaves the catalog before its panel navigates away: there is nothing left to save.
    const listed = queryClient
      .getQueryData<BoardCatalogResponse>(factoryKeys.boardCatalog(factoryId))
      ?.boards.some(other => other.id === boardId);
    return changed && listed !== false;
  });

  const discardEdits = () => {
    discard();
    setDiscards(count => count + 1);
  };
  const updatePhase = (next: StoredPhaseInfo) =>
    setDraft(current => ({
      ...current,
      phases: current.phases.map(candidate => (candidate.key === next.key ? next : candidate)),
    }));

  const model = canvasModel({
    boardKey: boardId,
    phases: draft.phases,
    rules: data.rules,
    flow: data.installed?.flow,
    filed: data.filed,
    skips: data.skips,
  });
  const selectedRule = focus && 'rule' in focus ? focus.rule : undefined;
  const selectedPhase = focus ? undefined : phase?.key;
  const subject = focus && 'test' in focus ? focus.test : undefined;
  const tested = useIntakeTestQuery(factoryId, selectedRule ? undefined : subject);
  const emphasis = emphasisOf(model, draft.phases, {
    phase: selectedPhase,
    rule: selectedRule,
    test: tested.data && { boardKey: boardId, result: tested.data },
    lane,
  });
  const landing = (line: RuleLine) => {
    const away = line.rule.target.moveToBoardKey;
    if (away && away !== boardId) {
      const other = data.boards.find(candidate => candidate.id === away);
      return other ? boardName(other) : away;
    }
    const key = line.rule.target.phaseKey ?? draft.phases[0]?.key;
    return draft.phases.find(candidate => candidate.key === key)?.name ?? 'a removed phase';
  };
  const lanes = { note: (line: RuleLine) => orderNote(line, model.lines, landing), onPeek: setLane };

  return (
    <>
      <CanvasFrame
        label={`${title} settings`}
        tabs={<BoardSettingsTabs boardId={boardId} active="settings" />}
        header={
          <BoardHeader
            board={board}
            draft={draft}
            readOnly={frozen}
            manageable={!readOnly}
            locked={locked}
            writes={writes}
            rulesFailed={data.rulesFailed}
            onChange={patch => setDraft(current => ({ ...current, ...patch }))}
          />
        }
        panel={
          focus || phaseKey
            ? {
                content: (
                  <CanvasPanel
                    factoryId={factoryId}
                    boardId={boardId}
                    focus={focus}
                    phase={phase}
                    phasePage={phasePage}
                    phases={draft.phases}
                    boardTitle={title}
                    codeBehaviour={board.codeBehaviour}
                    skills={host.skills}
                    disabled={frozen}
                    totals={data.totals}
                    onFocus={next => open(undefined, next)}
                    onClose={() => open()}
                    onChange={updatePhase}
                    unfinished={unfinished.fields}
                    onUnfinished={unfinished.mark}
                    onRemove={key => {
                      setDraft(current => ({ ...current, phases: removePhase(current.phases, key) }));
                      open();
                    }}
                  />
                ),
                onClose: () => open(),
              }
            : undefined
        }
        bar={
          <>
            {changed && (
              <DraftBar
                hold={hold}
                stale={stale}
                error={save.error?.reasons}
                saving={save.isPending}
                onSave={() =>
                  save.mutate({
                    name: draft.name,
                    description: draft.description,
                    phases: draft.phases,
                    expectedRevision: board.revision ?? 0,
                  })
                }
                onDiscard={discardEdits}
                onReload={onReload}
              />
            )}
            <CanvasToolbar>
              <TestInput key={subject} defaultValue={subject} onTest={test => open(undefined, { test })} />
            </CanvasToolbar>
          </>
        }
      >
        <div className="flex flex-col gap-14">
          <PhaseFlow
            factoryId={factoryId}
            boardId={boardId}
            model={model}
            boards={data.boards}
            totals={data.totals}
            emphasis={emphasis}
            lanes={lanes}
            selectedPhase={selectedPhase}
            selectedRule={selectedRule}
            problems={new Set(toFix.map(candidate => candidate.key))}
            rulesEditable={data.rulesEditable}
            order={data.order}
            skills={host.skills?.skills}
            edit={
              frozen
                ? undefined
                : {
                    required: key => new Set(board.codeBehaviour?.[key]?.requiredNextPhases),
                    onMoves: (key, nextPhases) =>
                      setDraft(current => ({
                        ...current,
                        phases: current.phases.map(candidate =>
                          candidate.key === key ? withNextPhases(candidate, nextPhases) : candidate,
                        ),
                      })),
                    onReorder: (from, to) =>
                      setDraft(current => ({ ...current, phases: movePhase(current.phases, from, to) })),
                    onAdd: (added, at, show) => {
                      setDraft(current => ({
                        ...current,
                        phases: [
                          ...current.phases.slice(0, at),
                          { ...added, kind: 'resting', nextPhases: [] },
                          ...current.phases.slice(at),
                        ],
                      }));
                      if (show) open(added.key);
                    },
                  }
            }
          />
          <OtherBoards
            factoryId={factoryId}
            boardId={boardId}
            boards={data.boards}
            leaving={model.leaving}
            stray={model.stray}
            strayIncoming={model.strayIncoming}
            emphasis={line => emphasis.line(line)}
            outside={emphasis.outside}
            lanes={lanes}
          />
        </div>
      </CanvasFrame>
      <LeaveDialog
        boardName={board.name}
        open={leaveGuard.blocked}
        onStay={() => leaveGuard.stay()}
        onLeave={() => {
          discard();
          leaveGuard.leave();
        }}
      />
    </>
  );
}
