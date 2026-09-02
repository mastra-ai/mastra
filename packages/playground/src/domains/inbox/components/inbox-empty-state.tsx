import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Inbox } from 'lucide-react';
import { Link } from 'react-router';

/** Shown instead of the tabs when neither list has anything waiting for review. */
export function InboxEmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<Inbox />}
        titleSlot="Your inbox is empty"
        descriptionSlot={
          <>
            Feedback left on traces and experiment results flagged for review <br />
            will show up here until you mark them reviewed.
          </>
        }
        actionSlot={
          <div className="flex items-center gap-2">
            <Button as={Link} to="/experiments" variant="outline">
              Go to experiments
            </Button>
            <Button as={Link} to="/traces" variant="outline">
              Go to traces
            </Button>
          </div>
        }
      />
    </div>
  );
}
