import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import type { DropdownMenuRadioOption } from '@mastra/playground-ui/components/DropdownMenu';
import { useState } from 'react';

import type { DiffLayout } from '../../../hooks/useDiffLayout';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';
import { IconDotGrid1x3Horizontal } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Horizontal';
import { IconLayoutColumn } from '@mastra/playground-ui/icons/central/IconLayoutColumn';

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
        <IconDotGrid1x3Horizontal />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.RadioSub
          label="Diff layout"
          icon={<IconLayoutColumn aria-hidden />}
          options={DIFF_LAYOUT_OPTIONS}
          value={layout}
          onValueChange={pickLayout}
        />
        <DropdownMenu.Item onClick={onRefresh}>
          <IconArrowRotateClockwise aria-hidden />
          <span>Refresh</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
