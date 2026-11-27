import { PhaseNotFoundPanel } from '@mastra/playground-ui/domains/factory';

import type { FactorySkillsResponse, StoredBoardInfo, StoredPhaseInfo } from '../../../../api/types';
import { HrefLink } from '../../../ui/HrefLink';
import { boardConfigPath } from '../../boardConfig/boardConfigPaths';
import type { CanvasFocus } from '../../boardConfig/boardConfigPaths';
import { canRemovePhase, kindLocked } from '../../boardConfig/boardDraft';
import type { RuleField } from '../../boardConfig/boardDraft';
import { PhasePanel } from './phasePanel/PhasePanel';
import { RulePanel } from './rulePanel/RulePanel';
import { TestPanel } from './testPanel/TestPanel';

interface CanvasPanelProps {
  factoryId: string;
  boardId: string;
  focus: CanvasFocus | undefined;
  /** The phase the page names; undefined when the board has no such phase. */
  phase: StoredPhaseInfo | undefined;
  /** What the phase panel's editors start over on: another phase, a new revision, a discard or a breakpoint. */
  phasePage: string | undefined;
  phases: StoredPhaseInfo[];
  boardTitle: string;
  codeBehaviour: StoredBoardInfo['codeBehaviour'];
  skills: FactorySkillsResponse | undefined;
  disabled: boolean;
  totals: ReadonlyMap<string, number>;
  onFocus: (focus: CanvasFocus) => void;
  onClose: () => void;
  onChange: (phase: StoredPhaseInfo) => void;
  /** The rule fields with a half-filled condition row on the open phase. */
  unfinished: readonly RuleField[];
  onUnfinished: (field: RuleField, unfinished: boolean) => void;
  onRemove: (phaseKey: string) => void;
}

/** What the canvas's side panel shows: a rule, a new rule, a test, the open phase, or that the phase is gone. */
export function CanvasPanel({
  factoryId,
  boardId,
  focus,
  phase,
  phasePage,
  phases,
  boardTitle,
  codeBehaviour,
  skills,
  disabled,
  totals,
  onFocus,
  onClose,
  onChange,
  unfinished,
  onUnfinished,
  onRemove,
}: CanvasPanelProps) {
  if (focus && 'rule' in focus) {
    return (
      <RulePanel
        key={focus.rule}
        factoryId={factoryId}
        boardId={boardId}
        focus={{ rule: focus.rule }}
        backTo={focus.test}
        onFocus={onFocus}
        onClose={onClose}
      />
    );
  }
  if (focus && 'newRule' in focus) {
    const { on, into, board: target } = focus.newRule;
    return (
      <RulePanel
        key={`new:${on ?? ''}:${into ?? ''}:${target ?? ''}`}
        factoryId={factoryId}
        boardId={boardId}
        focus={focus}
        onFocus={onFocus}
        onClose={onClose}
      />
    );
  }
  if (focus) {
    const { test } = focus;
    return (
      <TestPanel
        factoryId={factoryId}
        boardId={boardId}
        subject={test}
        onEditRule={rule => onFocus({ rule, test })}
        onClose={onClose}
      />
    );
  }
  if (phase) {
    const removable = !disabled && canRemovePhase(phases, phase.key, codeBehaviour);
    return (
      <PhasePanel
        // Each phase gets its own editors, so state one phase's editors hold never shows on another's panel.
        key={phasePage}
        phase={phase}
        phases={phases}
        requiredNextPhases={codeBehaviour?.[phase.key]?.requiredNextPhases ?? []}
        kindLocked={kindLocked(phases, phase.key, codeBehaviour)}
        skills={skills?.skills}
        skillsEditable={skills?.canEdit ?? false}
        factoryId={factoryId}
        boardId={boardId}
        disabled={disabled}
        total={totals.get(phase.key)}
        unfinished={unfinished}
        onChange={onChange}
        onUnfinished={onUnfinished}
        onRemove={removable ? () => onRemove(phase.key) : undefined}
        onClose={onClose}
      />
    );
  }
  return (
    <PhaseNotFoundPanel
      boardTitle={boardTitle}
      boardHref={boardConfigPath(factoryId, boardId)}
      LinkComponent={HrefLink}
    />
  );
}
