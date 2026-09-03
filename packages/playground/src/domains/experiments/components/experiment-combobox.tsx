import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { ExperimentsIcon } from '@mastra/playground-ui/icons/ExperimentsIcon';
import { useExperimentsForDatasetFilter } from '../hooks/use-experiments-for-dataset-filter';
import { getExperimentDisplayName } from '@/domains/experiments/utils/experiment-display-name';

export interface ExperimentComboboxProps {
  value?: string;
  onValueChange: (experimentId: string) => void;
  className?: string;
  variant?: ComboboxProps['variant'];
}

const DESCRIPTION_MAX = 60;

const truncate = (text: string) => (text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX)}…` : text);

/** Single-select picker over every experiment in the project, labelled by display name. */
export function ExperimentCombobox({ value, onValueChange, className, variant }: ExperimentComboboxProps) {
  const { data, isLoading, isError } = useExperimentsForDatasetFilter(undefined);

  const options = (data?.experiments ?? []).map(experiment => ({
    label: getExperimentDisplayName(experiment),
    value: experiment.id,
    start: <ExperimentsIcon className="text-neutral3 size-4 shrink-0" data-testid="experiments-icon" />,
    description: experiment.description
      ? truncate(experiment.description)
      : (getShortId(experiment.id) ?? experiment.id),
  }));

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onValueChange={onValueChange}
      placeholder={isLoading ? 'Loading experiments...' : isError ? 'Failed to load experiments' : 'Select experiment'}
      searchPlaceholder="Search experiments..."
      emptyText="No experiments found."
      className={className}
      disabled={isLoading || isError}
      variant={variant}
    />
  );
}
