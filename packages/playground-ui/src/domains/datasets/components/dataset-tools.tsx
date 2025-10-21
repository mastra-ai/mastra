import { Button } from '@/components/ui/elements/buttons';
import { Select } from '@/components/ui/elements/select';
import { useLinkComponent } from '@/lib/framework';
import { DatasetVersion } from '@mastra/client-js';
import { format, isToday, isThisYear } from 'date-fns';

import { PlusIcon, SearchIcon, SettingsIcon } from 'lucide-react';

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

  const versionOptions = (versions || [])?.map(version => {
    const isTodayDate = isToday(new Date(version.createdAt));
    const isThisYearDate = isThisYear(new Date(version.createdAt));

    const yearDateStr = isThisYearDate ? '' : format(new Date(version.createdAt), ', yyyy');
    const dayDateStr = isTodayDate ? 'Today' : format(new Date(version.createdAt), 'MMM dd');
    const timeStr = format(new Date(version.createdAt), 'h:mm:ss aaa');

    return `${dayDateStr}${yearDateStr} ${timeStr}`;
  });

  const handleVersionChange = (value: string) => {
    const newVersionId = versions?.[Number(value)]?.id;

    if (newVersionId && newVersionId !== selectedVersionId) {
      onVersionChange?.(newVersionId);
    }

    return;
  };

  return (
    <div className="grid grid-cols-[1fr_auto] gap-[3rem] items-center">
      <div className="items-center gap-4 max-w-[40rem] grid grid-cols-[3fr_2fr]">
        <div className="px-4 flex items-center gap-2 rounded-lg bg-surface5 focus-within:ring-2 focus-within:ring-accent3">
          <SearchIcon />

          <input
            type="text"
            placeholder="Search for a tool"
            className="w-full py-2 bg-transparent text-icon3 focus:text-icon6 placeholder:text-icon3 outline-none"
            value={''}
            onChange={() => {}}
          />
        </div>

        <Select
          name={'select-version'}
          onChange={handleVersionChange}
          value={versions?.findIndex(v => v.id === selectedVersionId).toString() || '0'}
          options={versionOptions}
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
