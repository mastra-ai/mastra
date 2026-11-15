import { ShieldAlertIcon } from 'lucide-react';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { IconClock } from '@/ds/icons/central/IconClock';
import { IconCodeBrackets } from '@/ds/icons/central/IconCodeBrackets';
import { IconExclamationCircle } from '@/ds/icons/central/IconExclamationCircle';
import { IconPlay } from '@/ds/icons/central/IconPlay';
import { IconSidebarSimpleRightWide } from '@/ds/icons/central/IconSidebarSimpleRightWide';
import { IconStepForwards } from '@/ds/icons/central/IconStepForwards';

const actions = {
  nested: { icon: IconSidebarSimpleRightWide, label: 'View nested graph', activeLabel: 'Hide nested graph' },
  map: { icon: IconCodeBrackets, label: 'Map config', activeLabel: 'Hide map config' },
  timeTravel: { icon: IconClock, label: 'Time travel' },
  runStep: { icon: IconPlay, label: 'Run step' },
  continueRun: { icon: IconStepForwards, label: 'Continue run' },
  resumeData: { icon: IconArrowRotateCounterClockwise, label: 'Resume data' },
  error: { icon: IconExclamationCircle, label: 'Error' },
  tripwire: { icon: ShieldAlertIcon, label: 'Tripwire' },
};

export interface WorkflowStepActionProps {
  action: keyof typeof actions;
  isActive?: boolean;
  onSelect: () => void;
}

export function WorkflowStepAction({ action, isActive, onSelect }: WorkflowStepActionProps) {
  const definition = actions[action];
  const ActionIcon = definition.icon;
  const label = isActive && 'activeLabel' in definition ? definition.activeLabel : definition.label;
  return (
    <DropdownMenu.Item onSelect={onSelect} className={action === 'tripwire' ? 'text-warning-foreground' : undefined}>
      <ActionIcon />
      <span>{label}</span>
    </DropdownMenu.Item>
  );
}
