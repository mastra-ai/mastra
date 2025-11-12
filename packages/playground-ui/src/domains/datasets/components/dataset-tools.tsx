import { SelectField } from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
import { useLinkComponent } from '@/lib/framework';
import { DatasetVersion } from '@mastra/client-js';
import { format, isToday, isThisYear } from 'date-fns';

import { PlusIcon, SettingsIcon } from 'lucide-react';

type DatasetToolsProps = {
  datasetId: string;
  onFilterChange?: (value: string) => void;
  onAdd?: () => void;
  onVersionChange?: (value: string) => void;
  selectedVersionId?: string;
  versions?: DatasetVersion[];
};

export function DatasetTools({ datasetId, onAdd, onVersionChange, selectedVersionId, versions }: DatasetToolsProps) {
  const { navigate, paths } = useLinkComponent();

  const handleVersionChange = (value: string) => {
    onVersionChange?.(value);
  };

  const versionOptions = (versions || []).map((version, index) => {
    const isTodayDate = isToday(new Date(version.createdAt));
    const isThisYearDate = isThisYear(new Date(version.createdAt));

    const yearDateStr = isThisYearDate ? '' : format(new Date(version.createdAt), ', yyyy');
    const dayDateStr = isTodayDate ? 'Today' : format(new Date(version.createdAt), 'MMM dd');
    const timeStr = format(new Date(version.createdAt), 'h:mm:ss aaa');

    return {
      label: `${dayDateStr}${yearDateStr} ${timeStr}`,
      value: version.id,
    };
  });

  return (
    <div className="grid grid-cols-[1fr_auto] gap-[3rem] items-center">
      <div className="items-center gap-4 max-w-[40rem] grid grid-cols-[3fr_2fr]">
        <SelectField
          label="Version"
          name={'select-version'}
          placeholder="Select..."
          options={versionOptions}
          onValueChange={handleVersionChange}
          value={selectedVersionId}
        />
      </div>

      <div className="flex gap-4">
        <Button onClick={onAdd} variant="outline">
          Add <PlusIcon />
        </Button>

        <Button onClick={() => navigate(`${paths.datasetLink(datasetId)}/settings`)} variant="outline">
          Settings <SettingsIcon />
        </Button>
      </div>
    </div>
  );
}
