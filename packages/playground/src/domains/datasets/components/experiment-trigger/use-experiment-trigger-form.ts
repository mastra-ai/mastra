import { useState } from 'react';
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

function defaultNameFor(targetName: string | undefined, suffix: string) {
  return targetName ? buildDefaultExperimentName(targetName, suffix) : '';
}

function buildDefaultValues(initial: ExperimentTriggerInitialValues, defaultName: string): ExperimentTriggerFormValues {
  return {
    name: initial.name ?? defaultName,
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
  // Starts as the id for a preselected target (its display name is only known once picked in the selector).
  const [targetName, setTargetName] = useState(initial.targetId);
  const [suffix, setSuffix] = useState(createNameSuffix);
  const defaultName = defaultNameFor(targetName, suffix);

  const form = useForm<ExperimentTriggerFormValues>({ defaultValues: buildDefaultValues(initial, defaultName) });
  const nameEdited = initial.name !== undefined || Boolean(form.formState.dirtyFields.name);
  // A cleared field still runs, under the default name it shows as its placeholder.
  const runName = form.watch('name').trim() || defaultName;

  const changeTargetName = (nextTargetName?: string) => {
    setTargetName(nextTargetName);
    if (!nameEdited) {
      form.resetField('name', { defaultValue: defaultNameFor(nextTargetName, suffix) });
    }
  };

  const resetForm = () => {
    const nextSuffix = createNameSuffix();
    setTargetName(initial.targetId);
    setSuffix(nextSuffix);
    form.reset(buildDefaultValues(initial, defaultNameFor(initial.targetId, nextSuffix)));
  };

  return { form, defaultName, runName, changeTargetName, resetForm };
}
