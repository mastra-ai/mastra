import type { ReactNode } from 'react';
import { GrowIn } from '../canvas-frame';
import { CellRow, FLOW_CELL, Wire } from '../flow-parts';
import { RetestBox } from './retest-box';
import { RuleHeader } from './rule-header';
import { MoveTo } from './rule-move-to';
import { RuleNotes } from './rule-notes';
import { RuleStats } from './rule-stats';
import { TriggerOrder } from './rule-trigger-order';
import { TriggerPicker } from './rule-trigger-picker';
import type {
  RuleDryRun,
  RuleLatestSkip,
  RuleNoteInfo,
  RuleRetestInfo,
  RuleTargetBoard,
  RuleTriggerOrderInfo,
  RuleTriggerSection,
  RuleTriggerText,
} from './types';
import { Button } from '@/ds/components/Button';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { IconChevronLeftMedium } from '@/ds/icons/central/IconChevronLeftMedium';

/** What the trigger pill says: the first trigger, and how many more. */
function triggerText<Event extends string>(
  value: readonly Event[],
  describe: (event: Event) => RuleTriggerText,
): string {
  const [first] = value;
  if (!first) return 'Pick a trigger';
  return value.length > 1 ? `${describe(first).label} +${value.length - 1}` : describe(first).label;
}

/** What a saved rule shows under its flow: notes, its place on each trigger, and what it did lately. */
export interface RuleEditorDetails<Event extends string> {
  /** The notes of the rule's own lines, one per text. */
  notes: readonly RuleNoteInfo[];
  /** The item the rule skipped last; undefined when it skipped none. */
  latestSkip: RuleLatestSkip | undefined;
  /** One per trigger the rule listens on. */
  orders: readonly RuleTriggerOrderInfo<Event>[];
  dryRun: RuleDryRun | undefined;
}

export interface RuleEditorViewProps<Event extends string> {
  /** The rule's own board. */
  board: RuleTargetBoard;
  boards: readonly RuleTargetBoard[];
  /** The saved rule; undefined for a new one. */
  rule: { id: string; name: string; enabled: boolean } | undefined;
  /** Set when a test opened the rule: goes back to it. */
  onBackToTest?: () => void;
  /** The rule's name; undefined while a new rule has no phase yet, so nothing to name. */
  name: string | undefined;
  maxNameLength: number;
  canEdit: boolean;
  /** A change to the rules is saving. */
  pending: boolean;
  /** Someone else changed the rule first. */
  conflict: string | undefined;
  /** The rule's triggers. */
  on: readonly Event[];
  triggerSections: readonly RuleTriggerSection<Event>[];
  describeTrigger: (event: Event) => RuleTriggerText;
  /** The rule's condition cells. */
  conditions: ReactNode;
  /** The rule also matches pull requests from outside authors. */
  outsiders: boolean;
  /** What stops the rule saving, in words. */
  problem: string | undefined;
  /** The pre-rename trigger the rule also listens on, by name; undefined when it doesn't. */
  legacyTrigger: string | undefined;
  /** The board the rule sends to. */
  boardKey: string;
  /** The phase the rule sends to; undefined until one is picked. */
  phaseKey: string | undefined;
  /** The target board's phases the rule may send to. */
  targetPhaseKeys: readonly string[];
  /** The rule files new items. */
  placesNew: boolean;
  /** The rule has unsaved changes, or is new. */
  dirty: boolean;
  /** How many of the newest items the unsaved rules would place differently. */
  preview: { changed?: number; sampled: number } | undefined;
  retest: RuleRetestInfo | undefined;
  saveError: string | undefined;
  /** The rule is whole, so it can save. */
  canSave: boolean;
  /** Set for a saved rule. */
  details: RuleEditorDetails<Event> | undefined;
  onClose: () => void;
  onRename: (name: string) => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onTriggers: (on: Event[]) => void;
  /** Narrows the rule to trusted pull request authors. */
  onAddTrusted: () => void;
  onTarget: (target: { boardKey: string; phaseKey: string | undefined }) => void;
  onDiscard: () => void;
  onSave: () => void;
  /** Lets outside authors' pull requests match the rule. */
  onUngate: () => void;
  onOpenRule: (ruleId: string) => void;
  onMoveRule: (event: Event, from: number, to: number) => void;
  onAddRule: (event: Event) => void;
}

/** One rule, saved or new, as a When → Only if → Move to flow, with its place among the board's rules. */
export function RuleEditorView<Event extends string>({
  board,
  boards,
  rule,
  onBackToTest,
  name,
  maxNameLength,
  canEdit,
  pending,
  conflict,
  on,
  triggerSections,
  describeTrigger,
  conditions,
  outsiders,
  problem,
  legacyTrigger,
  boardKey,
  phaseKey,
  targetPhaseKeys,
  placesNew,
  dirty,
  preview,
  retest,
  saveError,
  canSave,
  details,
  onClose,
  onRename,
  onToggle,
  onDelete,
  onTriggers,
  onAddTrusted,
  onTarget,
  onDiscard,
  onSave,
  onUngate,
  onOpenRule,
  onMoveRule,
  onAddRule,
}: RuleEditorViewProps<Event>) {
  const readOnly = !canEdit;

  return (
    <>
      {onBackToTest && (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" icon={<IconChevronLeftMedium />} onClick={onBackToTest}>
            Back to test
          </Button>
          <Txt as="span" variant="caption" tone="muted" className="truncate">
            {board.name} rule
          </Txt>
        </div>
      )}
      <RuleHeader
        rule={rule}
        boardName={board.name}
        icon={on[0] ? describeTrigger(on[0]).icon : undefined}
        name={name}
        maxNameLength={maxNameLength}
        readOnly={readOnly}
        pending={pending}
        onClose={onClose}
        onRename={onRename}
        onToggle={onToggle}
        onDelete={onDelete}
      />
      {conflict && (
        <Notice variant="warning" role="alert">
          {conflict}
        </Notice>
      )}

      <div className="flex flex-col">
        <div className={FLOW_CELL}>
          <CellRow label="When" stacked={triggerText(on, describeTrigger).length > 24}>
            <TriggerPicker
              value={on}
              sections={triggerSections}
              describe={describeTrigger}
              disabled={readOnly}
              onChange={onTriggers}
            />
          </CellRow>
        </div>
        <Wire />
        {conditions}
        {(outsiders || problem || legacyTrigger !== undefined) && (
          <div className="mt-2 flex flex-col gap-2">
            {outsiders && (
              <Notice
                variant="info"
                action={
                  !readOnly && <Notice.Button onClick={onAddTrusted}>Add: Pull request trusted is yes</Notice.Button>
                }
              >
                Also matches pull requests from outside authors.
              </Notice>
            )}
            {problem && <Notice variant="warning">{problem}</Notice>}
            {legacyTrigger !== undefined && (
              <Notice variant="info">
                Also listens on “{legacyTrigger}”, which takes new issues and pull requests. Saving keeps it.
              </Notice>
            )}
          </div>
        )}
        <Wire />
        {on.length === 0 ? (
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
            boardKey={boardKey}
            phaseKey={phaseKey}
            targetPhaseKeys={targetPhaseKeys}
            placesNew={placesNew}
            disabled={readOnly}
            onChange={onTarget}
          />
        )}
      </div>

      {canEdit &&
        dirty && (
          // Pulled up by the panel's gap and padded back, so the gap grows in with the bar instead of jumping open. A
          // new rule has it from the start, so it opens with the panel instead of growing in after.
          <GrowIn enter={rule !== undefined} className="-mt-4">
            <div className="flex flex-col gap-2 pt-4">
              {preview?.changed !== undefined && (
                <Txt as="p" variant="caption" tone="muted" role="status">
                  {preview.changed} of the last {preview.sampled} items would now land on a different board or phase.
                </Txt>
              )}
              <RetestBox retest={retest} />
              {saveError && (
                <Notice variant="destructive" role="alert">
                  {saveError}
                </Notice>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={rule ? onDiscard : onClose}>
                  {rule ? 'Discard' : 'Cancel'}
                </Button>
                <Button variant="primary" size="sm" disabled={!canSave} loading={pending} onClick={onSave}>
                  {rule ? 'Save' : 'Create rule'}
                </Button>
              </div>
            </div>
          </GrowIn>
        )}

      {rule && details && (
        <>
          <span className="h-px shrink-0 bg-border" aria-hidden />
          <RuleNotes notes={details.notes} latestSkip={details.latestSkip} canEdit={canEdit} onUngate={onUngate} />
          {details.orders.map(order => (
            <TriggerOrder
              key={order.event}
              label={order.label}
              after={order.after}
              fallback={order.fallback}
              lines={order.lines}
              ruleId={rule.id}
              board={board}
              boards={boards}
              canEdit={canEdit}
              pending={pending}
              onOpen={onOpenRule}
              onMove={(from, to) => onMoveRule(order.event, from, to)}
              onAdd={() => onAddRule(order.event)}
            />
          ))}
          <RuleStats ruleId={rule.id} dryRun={details.dryRun} />
        </>
      )}
    </>
  );
}
