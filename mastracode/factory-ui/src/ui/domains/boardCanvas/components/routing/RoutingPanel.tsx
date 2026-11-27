import type { CanvasFocus } from '../../../boardConfig/boardConfigPaths';
import { RulePanel } from '../rulePanel/RulePanel';
import { TestPanel } from '../testPanel/TestPanel';

/** The side panel for what the routing page focuses: a rule, a new rule, or an item tested against the rules. */
export function RoutingPanel({
  factoryId,
  boardId,
  focus,
  onFocus,
}: {
  factoryId: string;
  boardId: string;
  focus: CanvasFocus;
  /** Focuses something else; with nothing, closes the panel. */
  onFocus: (next?: CanvasFocus) => void;
}) {
  if ('newRule' in focus) {
    return (
      <RulePanel
        key="new"
        factoryId={factoryId}
        boardId={boardId}
        focus={focus}
        onFocus={onFocus}
        onClose={() => onFocus()}
      />
    );
  }
  if ('rule' in focus) {
    return (
      <RulePanel
        key={focus.rule}
        factoryId={factoryId}
        boardId={boardId}
        focus={{ rule: focus.rule }}
        backTo={focus.test}
        onFocus={onFocus}
        onClose={() => onFocus()}
      />
    );
  }
  return (
    <TestPanel
      key={focus.test}
      factoryId={factoryId}
      boardId={boardId}
      subject={focus.test}
      onEditRule={routeId => onFocus({ rule: routeId, test: focus.test })}
      onClose={() => onFocus()}
    />
  );
}
