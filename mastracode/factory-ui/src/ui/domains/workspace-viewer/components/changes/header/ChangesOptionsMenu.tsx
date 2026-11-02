import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';
import { Columns2, Ellipsis, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import type { DiffLayout } from '../../../hooks/useDiffLayout';

const DIFF_LAYOUT_OPTIONS = [
  { value: 'unified', label: 'Unified' },
  { value: 'split', label: 'Split' },
] as const satisfies readonly DropdownMenuRadioOption<DiffLayout>[];

interface ChangesOptionsMenuProps {
  layout: DiffLayout;
  onLayoutChange: (layout: DiffLayout) => void;
  onRefresh: () => void;
}

export function ChangesOptionsMenu({ layout, onLayoutChange, onRefresh }: ChangesOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const pickLayout = (picked: DiffLayout) => {
    setOpen(false);
    onLayoutChange(picked);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger variant="ghost" size="icon-sm" tooltip="Changes options" aria-label="Changes options">
        <Ellipsis />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.RadioSub
          label="Diff layout"
          icon={<Columns2 aria-hidden />}
          options={DIFF_LAYOUT_OPTIONS}
          value={layout}
          onValueChange={pickLayout}
        />
        <DropdownMenu.Item onClick={onRefresh}>
          <RefreshCw aria-hidden />
          <span>Refresh</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
