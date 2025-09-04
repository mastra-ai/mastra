import { Button } from '@/components/ui/elements/buttons';
// import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';
import { Select } from '@/components/ui/elements/select';
import { PlusIcon, SearchIcon } from 'lucide-react';

type DatasetItemsToolsProps = {
  onFilterChange?: (value: string) => void;
  onAdd?: () => void;
  currentVersion?: string;
  onVersionChange?: (value: string) => void;
  versionOptions?: string[];
};

export function DatasetItemsTools({ onAdd, onVersionChange, currentVersion, versionOptions }: DatasetItemsToolsProps) {
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
          onChange={onVersionChange}
          value={currentVersion}
          options={versionOptions || []}
        />
      </div>

      <Button onClick={onAdd} variant="outline">
        Add <PlusIcon />
      </Button>
    </div>
  );
}
