import { Button } from '@/ds/components/Button';
import { GitFork } from 'lucide-react';

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
