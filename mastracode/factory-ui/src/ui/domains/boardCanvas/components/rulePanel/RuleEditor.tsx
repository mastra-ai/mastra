import { RuleEditorView } from '@mastra/playground-ui/domains/factory';
import type { RuleTargetBoard } from '@mastra/playground-ui/domains/factory';
import { matchesOutsiderPullRequests } from '@mastra/factory/boards/board-events';
import type { RuleCondition } from '@mastra/factory/rules/rule-group';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useEffect, useRef, useState } from 'react';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../../api/types';
import { useIntakeDryRunPreview, useIntakeDryRunQuery } from '../../../../../hooks/useIntakeDryRun';
import { useIntakeOrderQuery, useSkippedRulesQuery } from '../../../../../hooks/useIntakeOrder';
import { useSourceSuggestions } from '../../../../../hooks/useSourceSuggestions';
import type { CanvasFocus } from '../../../boardConfig/boardConfigPaths';
import {
  LANE_SECTIONS,
  LEGACY_OPENED_EVENT,
  everythingOn,
  isOpenedLane,
  laneText,
  placesArrival,
} from '../../../boardRules/ruleLanes';
import type { RuleEvent } from '../../../boardRules/ruleLanes';
import { boardName, phaseName, phaseOptions } from '../../../boardRules/ruleTargets';
import { intakeRouteFacts } from '../../../settings/components/conditionFields';
import { boardRulesOf, ruleLines, ruleNotes, triggerFallback } from '../../canvasModel';
import type { RuleSkips } from '../../canvasModel';
import { MAX_RULE_NAME, draftRoutes, editOf, newEdit, resolveEdit, targetPhases, withCondition } from '../../ruleDraft';
import type { RuleEdit } from '../../ruleDraft';
import { CHANGED_FIRST, DELETED_FIRST } from '../../useRuleWrites';
import type { RuleWrites } from '../../useRuleWrites';
import { ConditionCells } from '../conditions/ConditionCells';
import { retestInfo, useRetest } from './Retest';

export interface RuleEditorProps {
  factoryId: string;
  /** The rule's own board. */
  board: InstalledBoardInfo;
  boards: readonly InstalledBoardInfo[];
  /** Every rule of the project, in order. */
  rules: readonly IntakeRouteInfo[];
  canEdit: boolean;
  /** The saved rule; undefined for a new one. */
  rule: IntakeRouteInfo | undefined;
  /** A new rule's trigger and phase, as the canvas picked them. */
  seed: { on?: string; into?: string } | undefined;
  backTo: string | undefined;
  writes: RuleWrites;
  onFocus: (focus: CanvasFocus) => void;
  onClose: () => void;
}

/** One rule, saved or new, as a When → Only if → Move to flow, with its place among the board's rules. */
export function RuleEditor({
  factoryId,
  board,
  boards,
  rules,
  canEdit,
  rule,
  seed,
  backTo,
  writes,
  onFocus,
  onClose,
}: RuleEditorProps) {
  const sources = useSourceSuggestions(factoryId);
  const order = useIntakeOrderQuery(factoryId);
  const skipped = useSkippedRulesQuery(factoryId);
  const dryRun = useIntakeDryRunQuery(factoryId);
  const preview = useIntakeDryRunPreview(factoryId);
  const retest = useRetest(factoryId, backTo);
  const [edit, setEdit] = useState<RuleEdit>();
  // Bumped when the panel rewrites the conditions itself: the editor reads them once per key.
  const [resets, setResets] = useState(0);
  const [conflict, setConflict] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  // A save that finishes after the panel moved on to another rule must not touch that one.
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const current = edit ?? (rule ? editOf(rule) : newEdit(board, seed));
  const resolved = resolveEdit(current, board, boards);
  const boardRules = boardRulesOf(rules, board.id);
  const dirty = edit !== undefined || !rule;
  const readOnly = !canEdit;
  const on: readonly string[] = current.on;

  const change = (patch: Partial<RuleEdit>) => {
    const next = { ...current, ...patch };
    setEdit(next);
    setSaveError(undefined);
    if (Object.keys(patch).every(key => key === 'name')) return;
    const draft = resolveEdit(next, board, boards).draft;
    const drafted = draft && [{ boardKey: board.id, routes: draftRoutes(boardRules, draft, next.base) }];
    retest.run(drafted);
    // Only rules that file new items change where the newest items land.
    if (drafted && (placesArrival(next.on) || (rule && placesArrival(rule.on)))) {
      preview.mutate({ boards: drafted });
    } else {
      preview.reset();
    }
  };

  const pickEvents = (next: RuleEvent[]) =>
    // An item with no card can only be filed on this board, so a rule that files one can't name another.
    change(
      placesArrival(next) && current.boardKey !== board.id
        ? { on: next, boardKey: board.id, phaseKey: undefined }
        : { on: next },
    );

  // The rule moves cards on pull request events for whoever opened them, so it can narrow itself to trusted authors.
  const addTrustedCondition = () => {
    const trusted: RuleCondition = { field: 'pullRequest.trusted', operator: 'equals', value: true };
    change({ when: withCondition(current.when, trusted), incomplete: false });
    setResets(count => count + 1);
  };

  const discard = () => {
    setEdit(undefined);
    setSaveError(undefined);
    preview.reset();
    retest.reset();
    setResets(count => count + 1);
  };

  // The switch, the arrows and "Let outside authors match" save at once; an edit under way keeps going from there.
  // The new revision reloads the condition cells, which drop a half-filled line, so nothing is left unfinished.
  const instant = async (write: Promise<IntakeRouteInfo[] | undefined>) => {
    const fresh = (await write)?.find(candidate => candidate.id === rule?.id);
    if (fresh && live.current) setEdit(started => started && { ...started, base: fresh, incomplete: false });
  };

  const save = async () => {
    const draft = resolved.draft;
    if (!draft || readOnly) return;
    setSaveError(undefined);
    setConflict(undefined);
    const outcome = await writes.save(draft, {
      rule: current.base,
      boardKey: board.id,
      onCreated: created => live.current && onFocus({ rule: created.id }),
    });
    if (!live.current) return;
    if (outcome.kind === 'saved') {
      setEdit(undefined);
      preview.reset();
      retest.reset();
    } else if (outcome.kind === 'fresh') {
      // Their version shows instead: resending this one would undo what they did.
      discard();
      setConflict(CHANGED_FIRST);
    } else if (outcome.kind === 'gone') {
      toast.error(DELETED_FIRST);
      onClose();
    } else {
      setSaveError(outcome.message);
    }
  };

  const remove = async () => {
    if (rule && (await writes.remove(rule)) && live.current) onClose();
  };

  const filed = new Map(dryRun.data?.boards.flatMap(entry => entry.rules.map(stats => [stats.routeId, stats.filed])));
  const skips = new Map(skipped.data?.skipped.map((entry): [string, RuleSkips] => [entry.routeId, entry]));
  const lines = rule ? ruleLines(boardRules, { filed, skips }) : [];
  const own = lines.filter(line => line.rule.id === rule?.id);
  const gated = rule?.outsiderPullRequestsGated === true;
  const outsiders = !gated && matchesOutsiderPullRequests(current.on, current.when);
  const at = order.data?.boards.findIndex(candidate => candidate.boardKey === board.id) ?? -1;
  const before = at > 0 && order.data ? order.data.boards.slice(0, at).map(candidate => candidate.name) : [];

  return (
    <RuleEditorView
      board={targetBoardOf(board)}
      boards={boards.map(targetBoardOf)}
      rule={rule}
      onBackToTest={backTo ? () => onFocus({ test: backTo }) : undefined}
      name={rule || (resolved.phase && on.length > 0) ? resolved.name : undefined}
      maxNameLength={MAX_RULE_NAME}
      canEdit={canEdit}
      pending={writes.pending}
      conflict={conflict}
      on={current.on}
      triggerSections={LANE_SECTIONS}
      describeTrigger={laneText}
      conditions={
        <ConditionCells
          key={`${resets}:${current.base?.revision ?? 'new'}`}
          label="Conditions"
          rule={current.when}
          facts={intakeRouteFacts(current.on)}
          options={{ ...phaseOptions(board), 'source.repository': sources }}
          disabled={readOnly || on.length === 0}
          everyText={everyTextOf(resolved.placesNew, on)}
          onChange={(when, incomplete) => change({ when, incomplete })}
        />
      }
      outsiders={outsiders}
      problem={resolved.problem}
      legacyTrigger={on.includes(LEGACY_OPENED_EVENT) ? laneText(LEGACY_OPENED_EVENT).label : undefined}
      boardKey={current.boardKey}
      phaseKey={resolved.phase?.id}
      targetPhaseKeys={targetPhases(
        boards.find(candidate => candidate.id === current.boardKey),
        resolved.placesNew,
      ).map(phase => phase.id)}
      placesNew={resolved.placesNew}
      dirty={dirty}
      preview={preview.data}
      retest={retestInfo(retest.now, retest.was, boards)}
      saveError={saveError}
      canSave={Boolean(resolved.draft)}
      details={
        rule && {
          // Each said once: a rule on two triggers can be hidden on both.
          notes: [...new Map(own.flatMap(ruleNotes).map(note => [note.text, note])).values()],
          latestSkip: own.find(line => line.skips)?.skips?.latest,
          orders: own.map(line => ({
            event: line.event,
            label: laneText(line.event).label,
            after: isOpenedLane(line.event) && order.data?.evaluator === 'intake-order' ? before : [],
            fallback: triggerFallback(line.event, {
              boardKey: board.id,
              boardRules,
              order: order.data?.boards,
              evaluator: order.data?.evaluator,
              phaseName: key => phaseName(board, key ?? null),
              flow: board.flow,
            }),
            lines: lines.filter(other => other.event === line.event),
          })),
          dryRun: dryRun.data,
        }
      }
      onClose={onClose}
      onRename={name => change({ name })}
      onToggle={enabled => rule && instant(writes.toggle(rule, enabled))}
      onDelete={remove}
      onTriggers={pickEvents}
      onAddTrusted={addTrustedCondition}
      onTarget={target => change(target)}
      onDiscard={discard}
      onSave={save}
      onUngate={() => rule && instant(writes.ungate(rule))}
      onOpenRule={id => onFocus({ rule: id })}
      onMoveRule={(event, from, to) => instant(writes.move(board.id, event, from, to))}
      onAddRule={event => onFocus({ newRule: { on: event, board: board.id } })}
    />
  );
}

/** A board as the rule panel reads it: its name and its phases' names resolved. */
function targetBoardOf(board: InstalledBoardInfo): RuleTargetBoard {
  return {
    id: board.id,
    name: boardName(board),
    initialPhase: board.initialPhase,
    phases: board.phases.map(phase => ({ id: phase.id, name: phase.name ?? phase.title, kind: phase.kind })),
  };
}

/** What a rule takes with no conditions: "Every card", or for one that files new items which: "Every new issue". */
function everyTextOf(placesNew: boolean, on: readonly string[]): string {
  if (!placesNew) return 'Every card';
  const [firstOn] = on;
  if (firstOn && on.every(event => everythingOn(event) === everythingOn(firstOn))) return everythingOn(firstOn);
  return 'Every new one';
}
