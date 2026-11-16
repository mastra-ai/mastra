import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { useState } from 'react';

import type { WorkspaceChangesScope } from '../../../../../../api/types';
import { IconChevronBottom } from '@mastra/playground-ui/icons/central/IconChevronBottom';

const SCOPE_LABELS: Record<WorkspaceChangesScope, string> = {
  branch: 'Branch changes',
  uncommitted: 'Uncommitted changes',
};

const SCOPE_OPTIONS = (['branch', 'uncommitted'] as const).map(value => ({ value, label: SCOPE_LABELS[value] }));

interface ChangesScopeMenuProps {
  scope: WorkspaceChangesScope;
  onScopeChange: (scope: WorkspaceChangesScope) => void;
}

export function ChangesScopeMenu({ scope, onScopeChange }: ChangesScopeMenuProps) {
  const [open, setOpen] = useState(false);
  const pickScope = (picked: WorkspaceChangesScope) => {
    setOpen(false);
    onScopeChange(picked);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger variant="ghost" size="sm" className="min-w-0">
        <span className="truncate">{SCOPE_LABELS[scope]}</span>
        <IconChevronBottom aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.RadioOptions options={SCOPE_OPTIONS} value={scope} onValueChange={pickScope} />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
