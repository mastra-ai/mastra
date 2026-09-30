import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus, Workflow, Zap } from 'lucide-react';

import { StoryWorkflowLink } from './StoryExplain';
import { LANE_CHIP_CLASS } from './laneChip';
import type { Storyboard } from './StoryboardProvider';
import { StoryLaneSequence } from './StoryLaneSequence';
import { rulesOnLane } from './storyRules';
import { workflowsOnLane } from './workflows/storyWorkflows';

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function footerLinkLabel(ruleCount: number, workflowCount: number): string {
  if (workflowCount > 0) return 'Open in Rules & workflows';
  return ruleCount > 0 ? 'Add a workflow' : 'Add a rule or workflow';
}

export function StoryLaneAutomations({ storyboard: { state }, stageId }: { storyboard: Storyboard; stageId: string }) {
  const rules = rulesOnLane(stageId);
  const workflows = workflowsOnLane(state, stageId);
  const empty = rules.length === 0 && workflows.length === 0;
  const summary = [
    rules.length > 0 && plural(rules.length, 'rule'),
    workflows.length > 0 && plural(workflows.length, 'workflow'),
  ]
    .filter(part => part !== false)
    .join(', ');

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Automations on this lane: ${summary || 'none'}`}
            className={LANE_CHIP_CLASS}
          >
            {empty ? (
              <>
                <Plus size={12} aria-hidden />
                No automations · Add
              </>
            ) : (
              <>
                {rules.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Zap size={12} aria-hidden />
                    {plural(rules.length, 'rule')}
                  </span>
                )}
                {rules.length > 0 && workflows.length > 0 && <span aria-hidden>·</span>}
                {workflows.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Workflow size={12} aria-hidden />
                    {plural(workflows.length, 'workflow')}
                  </span>
                )}
              </>
            )}
          </button>
        }
      />
      <PopoverContent align="end" className="flex max-h-[70vh] w-80 flex-col gap-3 overflow-y-auto p-3">
        {empty ? (
          <Txt as="p" variant="label" tone="ink">
            No automations on this lane
          </Txt>
        ) : (
          <StoryLaneSequence state={state} stageId={stageId} />
        )}
        <div className="border-border border-t pt-2">
          <StoryWorkflowLink workflowId={workflows[0]?.id}>
            {footerLinkLabel(rules.length, workflows.length)}
          </StoryWorkflowLink>
        </div>
      </PopoverContent>
    </Popover>
  );
}
