import { RulePanelMessage, SidePanel } from '@mastra/playground-ui/domains/factory';

import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../../hooks/useIntakeRoutes';
import type { CanvasFocus } from '../../../boardConfig/boardConfigPaths';
import { useRuleWrites } from '../../useRuleWrites';
import { RuleEditor } from './RuleEditor';

export interface RulePanelProps {
  factoryId: string;
  boardId: string;
  /** A saved rule, of this board or another; or a new one, with what the canvas picked for it. */
  focus: { rule: string } | { newRule: { on?: string; into?: string; board?: string } };
  /** The test the rule was opened from, to go back to. */
  backTo?: string;
  onFocus: (focus: CanvasFocus) => void;
  onClose: () => void;
}

/** One rule in the side panel: what it listens for, which items it takes, where it sends them, and where it stands. */
export function RulePanel({ factoryId, boardId, focus, backTo, onFocus, onClose }: RulePanelProps) {
  const routes = useIntakeRoutesQuery(factoryId);
  const boards = useBoardCatalog(factoryId);
  // Shared by every control of the rule. Both parents key the panel by its rule, so a new rule's move above a
  // catch-all can still be running when the panel switches to the saved rule: the new panel's writes don't wait for it.
  const writes = useRuleWrites(factoryId);

  const ruleId = 'rule' in focus ? focus.rule : undefined;
  const seed = 'newRule' in focus ? focus.newRule : undefined;
  const rule = ruleId === undefined ? undefined : routes.data?.intakeRoutes.find(candidate => candidate.id === ruleId);
  const board = boards.data?.find(candidate => candidate.id === (rule?.target.boardKey ?? seed?.board ?? boardId));

  const failed = routes.error ?? boards.error;
  if (failed) return <RulePanelMessage text={failed.message} error onClose={onClose} />;
  if (!routes.data || !boards.data) return <RulePanelMessage text="Loading the rule…" onClose={onClose} />;
  if (ruleId !== undefined && !rule) return <RulePanelMessage text="This rule no longer exists." onClose={onClose} />;
  if (!board) return <RulePanelMessage text="That board is no longer installed." onClose={onClose} />;

  return (
    <SidePanel label={rule ? rule.name : 'New rule'}>
      <RuleEditor
        key={ruleId ?? `new:${board.id}:${seed?.on ?? ''}:${seed?.into ?? ''}`}
        factoryId={factoryId}
        board={board}
        boards={boards.data}
        rules={routes.data.intakeRoutes}
        canEdit={routes.data.canEdit}
        rule={rule}
        seed={seed}
        backTo={backTo}
        writes={writes}
        onFocus={onFocus}
        onClose={onClose}
      />
    </SidePanel>
  );
}
