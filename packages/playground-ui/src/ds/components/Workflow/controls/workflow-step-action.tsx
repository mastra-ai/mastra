import {
  AlertCircleIcon,
  BracesIcon,
  Clock3Icon,
  LayersIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  StepForwardIcon,
} from 'lucide-react';
import { DropdownMenu } from '@/ds/components/DropdownMenu';

const actions = {
  nested: { icon: LayersIcon, label: 'View nested graph', activeLabel: 'Hide nested graph' },
  map: { icon: BracesIcon, label: 'Map config', activeLabel: 'Hide map config' },
  timeTravel: { icon: Clock3Icon, label: 'Time travel' },
  runStep: { icon: PlayIcon, label: 'Run step' },
  continueRun: { icon: StepForwardIcon, label: 'Continue run' },
  resumeData: { icon: RotateCcwIcon, label: 'Resume data' },
  error: { icon: AlertCircleIcon, label: 'Error' },
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
    <DropdownMenu.Item onSelect={onSelect} className={action === 'tripwire' ? 'text-amber-400' : undefined}>
      <ActionIcon />
      <span>{label}</span>
    </DropdownMenu.Item>
  );
}
