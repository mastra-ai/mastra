import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconCrossMedium } from '@mastra/playground-ui/icons/central/IconCrossMedium';

import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../../hooks/useIntakeRoutes';
import type { CanvasFocus } from '../../../boardConfig/boardConfigPaths';
import { SidePanel } from '../CanvasChrome';
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
  if (failed) return <PanelMessage text={failed.message} error onClose={onClose} />;
  if (!routes.data || !boards.data) return <PanelMessage text="Loading the rule…" onClose={onClose} />;
  if (ruleId !== undefined && !rule) return <PanelMessage text="This rule no longer exists." onClose={onClose} />;
  if (!board) return <PanelMessage text="That board is no longer installed." onClose={onClose} />;

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

/** The panel while there is no rule to show: loading, failed, or gone. */
function PanelMessage({ text, error = false, onClose }: { text: string; error?: boolean; onClose: () => void }) {
  return (
    <SidePanel label="Rule">
      <div className="flex items-start justify-between gap-2">
        <PanelMessageText text={text} error={error} />
        <Button variant="ghost" size="icon-sm" tooltip="Close" aria-label="Close" onClick={onClose}>
          <IconCrossMedium />
        </Button>
      </div>
    </SidePanel>
  );
}

function PanelMessageText({ text, error }: { text: string; error: boolean }) {
  if (error) {
    return (
      <Notice variant="destructive" className="min-w-0 flex-1">
        {text}
      </Notice>
    );
  }
  return (
    <Txt as="p" variant="body-sm" tone="muted" role="status">
      {text}
    </Txt>
  );
}
