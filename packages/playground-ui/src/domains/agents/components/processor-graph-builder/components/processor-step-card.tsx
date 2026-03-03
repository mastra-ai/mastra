import { useState, useCallback } from 'react';
import { Settings, X } from 'lucide-react';
import { Badge } from '@/ds/components/Badge';
import { IconButton } from '@/ds/components/IconButton';
import { Txt } from '@/ds/components/Txt';
import { useProcessorGraphBuilderContext } from './processor-graph-builder-context';
import { ProcessorConfigDialog } from './processor-config-dialog';
import type { ProcessorGraphStep, ProcessorPhase } from '../types';
import { PHASE_SHORT_LABELS } from '../utils/phase-labels';

interface ProcessorStepCardProps {
  layerId: string;
  step: ProcessorGraphStep;
  branchIndex?: number;
  conditionIndex?: number;
  stepIndex?: number;
}

export function ProcessorStepCard({ layerId, step, branchIndex, conditionIndex, stepIndex }: ProcessorStepCardProps) {
  const { builder, providers, readOnly } = useProcessorGraphBuilderContext();
  const provider = providers.find(p => p.id === step.providerId);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const handleRemove = () => {
    if (conditionIndex !== undefined && stepIndex !== undefined) {
      builder.removeStepFromCondition(layerId, conditionIndex, stepIndex);
    } else if (branchIndex !== undefined && stepIndex !== undefined) {
      builder.removeStepFromBranch(layerId, branchIndex, stepIndex);
    } else {
      builder.setStep(layerId, { id: step.id, providerId: '', config: {}, enabledPhases: [] });
    }
  };

  const handleSave = useCallback(
    (config: Record<string, unknown>, enabledPhases: ProcessorPhase[]) => {
      if (conditionIndex !== undefined && stepIndex !== undefined) {
        builder.updateConditionStepConfig(layerId, conditionIndex, stepIndex, config);
        builder.updateConditionStepPhases(layerId, conditionIndex, stepIndex, enabledPhases);
      } else if (branchIndex !== undefined && stepIndex !== undefined) {
        builder.updateBranchStepConfig(layerId, branchIndex, stepIndex, config);
        builder.updateBranchStepPhases(layerId, branchIndex, stepIndex, enabledPhases);
      } else {
        builder.updateStepConfig(layerId, config);
        builder.updateStepPhases(layerId, enabledPhases);
      }
    },
    [builder, layerId, branchIndex, conditionIndex, stepIndex],
  );

  return (
    <>
      <div className="flex items-center gap-2 rounded border border-border1 bg-surface3 p-2">
        <div className="flex-1 min-w-0">
          <Txt variant="ui-sm" className="text-neutral5 truncate">
            {provider?.name ?? step.providerId}
          </Txt>
          {step.enabledPhases.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {step.enabledPhases.map((phase: ProcessorPhase) => (
                <Badge key={phase}>{PHASE_SHORT_LABELS[phase] ?? phase}</Badge>
              ))}
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <IconButton variant="ghost" size="sm" tooltip="Configure" onClick={() => setIsConfigOpen(true)}>
              <Settings className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton variant="ghost" size="sm" tooltip="Remove" onClick={handleRemove}>
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        )}
      </div>

      <ProcessorConfigDialog
        step={step}
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSave={handleSave}
      />
    </>
  );
}
