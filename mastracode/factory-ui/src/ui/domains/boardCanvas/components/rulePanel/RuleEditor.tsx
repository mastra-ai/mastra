import { matchesOutsiderPullRequests } from '@mastra/factory/boards/board-events';
import type { RuleCondition } from '@mastra/factory/rules/rule-group';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconChevronLeftMedium } from '@mastra/playground-ui/icons/central/IconChevronLeftMedium';
import { useEffect, useRef, useState } from 'react';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../../api/types';
import { useIntakeDryRunPreview, useIntakeDryRunQuery } from '../../../../../hooks/useIntakeDryRun';
import { useIntakeOrderQuery, useSkippedRulesQuery } from '../../../../../hooks/useIntakeOrder';
import { useSourceSuggestions } from '../../../../../hooks/useSourceSuggestions';
import type { CanvasFocus } from '../../../boardConfig/boardConfigPaths';
import { LEGACY_OPENED_EVENT, everythingOn, laneText, placesArrival } from '../../../boardRules/ruleLanes';
import type { RuleEvent } from '../../../boardRules/ruleLanes';
import { boardName, phaseOptions } from '../../../boardRules/ruleTargets';
import { intakeRouteFacts } from '../../../settings/components/conditionFields';
import { boardRulesOf, ruleLines } from '../../canvasModel';
import type { RuleSkips } from '../../canvasModel';
import { draftRoutes, editOf, newEdit, resolveEdit, withCondition } from '../../ruleDraft';
import type { RuleEdit } from '../../ruleDraft';
import { CHANGED_FIRST, DELETED_FIRST } from '../../useRuleWrites';
import type { RuleWrites } from '../../useRuleWrites';
import { GrowIn } from '../CanvasChrome';
import { ConditionCells } from '../conditions/ConditionCells';
import { CellRow, FLOW_CELL, Wire } from '../conditions/flowParts';
import { MoveTo } from './MoveTo';
import { RetestBox, useRetest } from './Retest';
import { RuleHeader } from './RuleHeader';
import { RuleNotes } from './RuleNotes';
import { RuleStats } from './RuleStats';
import { TriggerOrder } from './TriggerOrder';
import { TriggerPicker, triggerText } from './TriggerPicker';

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

  return (
    <>
      {backTo && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" icon={<IconChevronLeftMedium />} onClick={() => onFocus({ test: backTo })}>
            Back to test
          </Button>
          <Txt as="span" variant="caption" tone="muted" className="truncate">
            {boardName(board)} rule
          </Txt>
        </div>
      )}
      <RuleHeader
        rule={rule}
        board={board}
        icon={current.on[0] ? laneText(current.on[0]).icon : undefined}
        name={rule || (resolved.phase && on.length > 0) ? resolved.name : undefined}
        readOnly={readOnly}
        pending={writes.pending}
        onClose={onClose}
        onRename={name => change({ name })}
        onToggle={enabled => rule && instant(writes.toggle(rule, enabled))}
        onDelete={remove}
      />
      {conflict && (
        <Notice variant="warning" role="alert">
          {conflict}
        </Notice>
      )}

      <div className="flex flex-col">
        <div className={FLOW_CELL}>
          <CellRow label="When" stacked={triggerText(on).length > 24}>
            <TriggerPicker value={current.on} disabled={readOnly} onChange={pickEvents} />
          </CellRow>
        </div>
        <Wire />
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
        {(outsiders || resolved.problem || on.includes(LEGACY_OPENED_EVENT)) && (
          <div className="mt-2 flex flex-col gap-2">
            {outsiders && (
              <Notice
                variant="info"
                action={
                  !readOnly && (
                    <Notice.Button onClick={addTrustedCondition}>Add: Pull request trusted is yes</Notice.Button>
                  )
                }
              >
                Also matches pull requests from outside authors.
              </Notice>
            )}
            {resolved.problem && <Notice variant="warning">{resolved.problem}</Notice>}
            {on.includes(LEGACY_OPENED_EVENT) && (
              <Notice variant="info">
                Also listens on “{laneText(LEGACY_OPENED_EVENT).label}”, which takes new issues and pull requests.
                Saving keeps it.
              </Notice>
            )}
          </div>
        )}
        <Wire />
        {current.on.length === 0 ? (
          <div className={FLOW_CELL}>
            <CellRow label="Move to">
              <Txt as="span" variant="body-sm" tone="muted">
                Pick a trigger first
              </Txt>
            </CellRow>
          </div>
        ) : (
          <MoveTo
            board={board}
            boards={boards}
            boardKey={current.boardKey}
            phaseKey={resolved.phase?.id}
            placesNew={resolved.placesNew}
            disabled={readOnly}
            onChange={target => change(target)}
          />
        )}
      </div>

      {canEdit &&
        dirty && (
          // Pulled up by the panel's gap and padded back, so the gap grows in with the bar instead of jumping open.
          <GrowIn className="-mt-4">
            <div className="flex flex-col gap-2 pt-4">
              {preview.data?.changed !== undefined && (
                <Txt as="p" variant="caption" tone="muted" role="status">
                  {preview.data.changed} of the last {preview.data.sampled} items would now land on a different board or
                  phase.
                </Txt>
              )}
              <RetestBox now={retest.now} was={retest.was} boards={boards} />
              {saveError && (
                <Notice variant="destructive" role="alert">
                  {saveError}
                </Notice>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={rule ? discard : onClose}>
                  {rule ? 'Discard' : 'Cancel'}
                </Button>
                <Button variant="primary" size="sm" disabled={!resolved.draft} loading={writes.pending} onClick={save}>
                  {rule ? 'Save' : 'Create rule'}
                </Button>
              </div>
            </div>
          </GrowIn>
        )}

      {rule && (
        <>
          <span className="bg-border h-px shrink-0" aria-hidden />
          <RuleNotes lines={own} canEdit={canEdit} onUngate={() => instant(writes.ungate(rule))} />
          {own.map(line => (
            <TriggerOrder
              key={line.event}
              event={line.event}
              lines={lines.filter(other => other.event === line.event)}
              rule={rule}
              board={board}
              boards={boards}
              boardRules={boardRules}
              order={order.data}
              canEdit={canEdit}
              pending={writes.pending}
              onOpen={id => onFocus({ rule: id })}
              onMove={(from, to) => instant(writes.move(board.id, line.event, from, to))}
              onAdd={() => onFocus({ newRule: { on: line.event, board: board.id } })}
            />
          ))}
          <RuleStats ruleId={rule.id} dryRun={dryRun.data} />
        </>
      )}
    </>
  );
}

/** What a rule takes with no conditions: "Every card", or for one that files new items which: "Every new issue". */
function everyTextOf(placesNew: boolean, on: readonly string[]): string {
  if (!placesNew) return 'Every card';
  const [firstOn] = on;
  if (firstOn && on.every(event => everythingOn(event) === everythingOn(firstOn))) return everythingOn(firstOn);
  return 'Every new one';
}
