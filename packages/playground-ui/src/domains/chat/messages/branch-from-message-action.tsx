import { Button } from '@mastra/playground-ui/components/Button';
import { GitFork } from 'lucide-react';

export const BranchFromMessageAction = ({ onBranch, disabled }: { onBranch: () => void; disabled?: boolean }) => (
  <Button
    variant="ghost"
    size="icon-xs"
    tooltip="Branch from here"
    aria-label="Branch from here"
    onClick={onBranch}
    disabled={disabled}
  >
    <GitFork />
  </Button>
);
