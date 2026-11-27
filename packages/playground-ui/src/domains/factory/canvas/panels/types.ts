import type { LucideIcon } from 'lucide-react';
import type { BoardPhaseKind } from '../../board/board-icons';

/** A condition group a phase or rule holds; the panels only count its conditions. */
export interface PanelRuleGroup {
  conditions: readonly unknown[];
}

/** The goal a working phase's runs pursue. */
export interface PanelPhaseGoal {
  objective: string;
  maxRuns?: number;
}

/** What a working phase's agent loads and is told. */
export interface PanelPhaseRunner {
  skill?: string;
  context?: string;
  instructions?: string;
  goal?: PanelPhaseGoal;
}

/** An outcome a phase's session may report, and the phase it moves the card to. */
export interface PanelPhaseOutcome {
  key: string;
  label: string;
  to: string;
}

/** A board phase as the phase panel reads it. */
export interface PanelPhase {
  key: string;
  name: string;
  kind: BoardPhaseKind;
  description?: string | null;
  runner?: PanelPhaseRunner | null;
  autoStart?: boolean;
  autoStartWhen?: PanelRuleGroup | null;
  exitTool?: { id: string; autoApprove?: boolean; autoApproveWhen?: PanelRuleGroup } | null;
  tools?: readonly string[] | null;
  outcomes?: readonly PanelPhaseOutcome[] | null;
}

/** A phase rule a half-filled condition row can hold. */
export type PhaseRuleField = 'autoStartWhen' | 'autoApproveWhen';

/** A skill the factory serves, as the phase panel reads it. */
export interface PanelSkill {
  name: string;
  description: string;
  /** Set when the skill fails to load. */
  error?: string;
}

/** A phase a rule can send to, its name resolved. */
export interface RuleTargetPhase {
  id: string;
  name: string;
  kind: BoardPhaseKind;
}

/** A board a rule can send to, its name and its phases' names resolved. */
export interface RuleTargetBoard {
  id: string;
  name: string;
  initialPhase: string;
  phases: readonly RuleTargetPhase[];
}

/** What a trigger is called and shows as. */
export interface RuleTriggerText {
  label: string;
  icon: LucideIcon;
  /** GitLab reports no such event. */
  githubOnly?: boolean;
}

/** A group of triggers in the trigger picker's menu. */
export interface RuleTriggerSection<Event extends string = string> {
  title: string;
  events: readonly Event[];
}

/** Something worth knowing about a rule, said once. */
export interface RuleNoteInfo {
  /** Warnings mark the rule's chip; the rest only explain it. */
  tone: 'warning' | 'muted';
  text: string;
  /** A note the rule panel acts on: the latest skipped item, or letting outside authors match. */
  kind?: 'skips' | 'outsiders';
}

/** The item a rule skipped last. */
export interface RuleLatestSkip {
  title: string;
  url: string | null;
}

/** One rule on one trigger, with its place there. */
export interface RuleOrderLine {
  /** Its place on the trigger, from 1: the first rule that matches wins. */
  rank: number;
  label: string;
  rule: { id: string; target: { phaseKey: string | null; moveToBoardKey: string | null } };
}

/** One trigger the rule listens on, with every rule of the board on it in the order Factory checks them. */
export interface RuleTriggerOrderInfo<Event extends string = string> {
  event: Event;
  label: string;
  /** The boards whose rules Factory checks first; empty when none do or the order doesn't apply. */
  after: readonly string[];
  /** What happens to what no rule takes; undefined when a rule takes everything. */
  fallback: string | undefined;
  /** The board's rules on this trigger, in order. */
  lines: readonly RuleOrderLine[];
}

/** What the newest items would do under the saved rules. */
export interface RuleDryRun {
  sampled: number;
  boards: readonly {
    boardKey: string;
    name: string;
    rules: readonly {
      routeId: string;
      filed: number;
      takes: readonly unknown[];
      lost: readonly { boardKey: string; keys: readonly unknown[] }[];
    }[];
  }[];
}

/** Where a test's item lands under the unsaved rules, and where it did under the saved ones. */
export interface RuleRetestInfo {
  title: string;
  after: string;
  /** Undefined until the saved rules' test loads. */
  before: string | undefined;
}

/** What a rule answered in an intake test, and that answer in words. */
export interface IntakeTestRuleAnswer {
  routeId: string;
  name: string | null;
  /** `took` decides; `lost` matched after the rule that took it; `phase_refuses` matched but its phase can't hold the item. */
  outcome: 'took' | 'lost' | 'no_match' | 'phase_refuses' | 'disabled';
  verdict: string;
}

/** What a board answered for a new item, with each of its rules. */
export interface IntakeTestBoardAnswer {
  boardKey: string;
  name: string;
  rules: readonly IntakeTestRuleAnswer[];
}

/** One status event replayed on the item's card, and what its rules said. */
export interface IntakeTestCardMove {
  key: string;
  /** The event, in words. */
  event: string;
  /** What the move did, in words. */
  verdict: string;
  rules: readonly { routeId: string; name: string; outcome: string; verdict: string }[];
}

/** Where an intake test says an item would go, ready to show. */
export interface IntakeTestResultInfo {
  item: { title: string; url: string | null; kind: 'card' | 'not_routed' | 'fetched' };
  /** Where the item goes; null when it isn't routed. */
  placement: { place: string; boardName: string; boardHref: string } | null;
  /** Why the item isn't routed. */
  reason: string | null;
  /** The project still files new items with the old route list. */
  legacyEvaluator: boolean;
  note: string | null;
  /** What each board answered, in the order intake asks them. */
  boards: readonly IntakeTestBoardAnswer[];
  /** The item's card and what replaying its events did; null when it has none. */
  card: { place: string; moves: readonly IntakeTestCardMove[] } | null;
}
