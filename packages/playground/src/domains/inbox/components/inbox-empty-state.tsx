import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ExperimentsIcon } from '@mastra/playground-ui/icons/ExperimentsIcon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { Link } from 'react-router';

/** Shown instead of the tabs when neither list has anything waiting for review. */
export function InboxEmptyState() {
  return (
    <EmptyState
      titleSlot="Your inbox is empty"
      descriptionSlot={
        <>
          Feedback left on traces and experiment results flagged for review <br />
          will show up here until you mark them reviewed.
        </>
      }
      actionSlot={
        <div className="flex items-center gap-2">
          <Button icon={<ExperimentsIcon />} render={<Link to="/experiments" />}>
            Go to experiments
          </Button>
          <Button icon={<TraceIcon />} render={<Link to="/traces" />}>
            Go to traces
          </Button>
        </div>
      }
      variant="fill"
    />
  );
}
