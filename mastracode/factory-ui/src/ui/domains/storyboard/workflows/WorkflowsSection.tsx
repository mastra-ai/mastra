import { Button } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { useScrollToHash } from '../StoryExplain';
import { useStoryboard } from '../StoryboardProvider';
import { NEW_WORKFLOW_ANCHOR, workflowAnchorId } from '../storyLinks';
import { StorySectionHeader } from '../StorySectionHeader';
import { laneStepPayer } from './storyWorkflows';
import { WorkflowBuilder } from './WorkflowBuilder';
import { WorkflowFlow } from './WorkflowFlow';

export function StoryWorkflowsSection() {
  const storyboard = useStoryboard();
  const linkedAnchor = useScrollToHash(storyboard !== null);
  const [building, setBuilding] = useState(linkedAnchor === NEW_WORKFLOW_ANCHOR);
  if (storyboard === null) return null;
  const { state } = storyboard;

  return (
    <section aria-labelledby="story-workflows-heading" className="mb-8 flex shrink-0 flex-col gap-4">
      <StorySectionHeader
        id="story-workflows-heading"
        title="Workflows"
        description="A chain of steps a card runs through when it enters a lane. Each agent step runs on the lane model unless it pins its own."
        action={
          !building && (
            <Button variant="default" size="sm" onClick={() => setBuilding(true)}>
              <Plus aria-hidden />
              New workflow
            </Button>
          )
        }
      />
      <div id={NEW_WORKFLOW_ANCHOR} className="scroll-mt-4">
        {building && <WorkflowBuilder storyboard={storyboard} onClose={() => setBuilding(false)} />}
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.workflows.map(workflow => (
          <li
            key={workflow.id}
            id={workflowAnchorId(workflow.id)}
            className={cn(
              'border-border scroll-mt-4 rounded-xl border p-4',
              linkedAnchor === workflowAnchorId(workflow.id) && 'bg-info-subtle',
            )}
          >
            <WorkflowFlow workflow={workflow} payerFor={step => laneStepPayer(state, step, workflow.lanes[0])} />
          </li>
        ))}
      </ul>
    </section>
  );
}
