import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ArrowLeft, CircleSlashIcon } from 'lucide-react';
import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        as="h1"
        iconSlot={<CircleSlashIcon className="text-neutral3 h-8 w-8" />}
        titleSlot="Page not found"
        descriptionSlot="The page you requested doesn't exist in this Studio."
        actionSlot={
          <Button as={Link} to="/agents" variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Studio
          </Button>
        }
      />
    </div>
  );
}
