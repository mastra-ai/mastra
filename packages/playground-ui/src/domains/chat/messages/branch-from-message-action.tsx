import { GitFork } from 'lucide-react';
import { Button } from '@/ds/components/Button';

export const BranchFromMessageAction = ({ onBranch, disabled }: { onBranch: () => void; disabled?: boolean }) => (
  <Button
    variant="ghost"
    size="icon-sm"
    tooltip="Branch from here"
    aria-label="Branch from here"
    onClick={onBranch}
    disabled={disabled}
  >
    <GitFork />
  </Button>
);
