import { useForm } from 'react-hook-form';
import { buildDefaultExperimentName, createNameSuffix } from '../../utils/default-names';
import type { TargetType } from './target-selector';

export interface ExperimentTriggerFormValues {
  name: string;
  description: string;
  datasetId: string;
  version?: number;
  targetType: TargetType | '';
  targetId: string;
  /** Unset until the user picks scorers; the dataset's default scorers apply meanwhile. */
  scorerIds?: string[];
  requestContextValues: Record<string, unknown>;
  requestContextRaw: string;
}

export interface ExperimentTriggerInitialValues {
  name?: string;
  description?: string;
  datasetId?: string;
  version?: number;
  targetType?: TargetType;
  targetId?: string;
  scorerIds?: string[];
}

/** The target's name plus a fresh short id, e.g. "chef-agent-a3f9"; empty until a target is picked. */
function defaultNameFor(targetName?: string) {
  return targetName ? buildDefaultExperimentName(targetName, createNameSuffix()) : '';
}

function buildDefaultValues(initial: ExperimentTriggerInitialValues): ExperimentTriggerFormValues {
  return {
    // A preselected target starts from its id; its display name is only known once picked in the selector.
    name: initial.name ?? defaultNameFor(initial.targetId),
    description: initial.description ?? '',
    datasetId: initial.datasetId ?? '',
    version: initial.version,
    targetType: initial.targetType ?? '',
    targetId: initial.targetId ?? '',
    scorerIds: initial.scorerIds,
    requestContextValues: {},
    requestContextRaw: '',
  };
}

/**
 * Form state for the Run experiment dialog. The name defaults to the target name plus a short id and
 * follows the target until the user edits it. An initial name (rerun) counts as edited.
 */
export function useExperimentTriggerForm(initial: ExperimentTriggerInitialValues) {
  const form = useForm<ExperimentTriggerFormValues>({ defaultValues: buildDefaultValues(initial) });

  const changeTargetName = (targetName?: string) => {
    const nameEdited = initial.name !== undefined || form.getValues('name') !== form.formState.defaultValues?.name;
    if (nameEdited) return;
    form.resetField('name', { defaultValue: defaultNameFor(targetName) });
  };

  const resetForm = () => form.reset(buildDefaultValues(initial));

  return { form, changeTargetName, resetForm };
}
