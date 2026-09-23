import { MoreVerticalIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

export function WorkflowStepActions({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Step actions"
            title="Step actions"
            className="nodrag nopan"
          >
            <MoreVerticalIcon />
          </Button>
        }
      />
      <DropdownMenu.Content align="end">{children}</DropdownMenu.Content>
    </DropdownMenu>
  );
}
