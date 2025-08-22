import { SelectField, SearchField } from '@/components/ui/elements';
import { Button } from '@/components/ui/elements/buttons';
import { cn } from '@/lib/utils';
import { XIcon } from 'lucide-react';

type TemplatesToolsProps = {
  selectedTag: string;
  onTagChange: (value: string) => void;
  tagOptions: { value: string; label: string }[];
  selectedProvider: string;
  providerOptions: { value: string; label: string }[];
  onProviderChange: (value: string) => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  onReset?: () => void;
  className?: string;
  isLoading?: boolean;
};

export function TemplatesTools({
  tagOptions,
  selectedTag,
  providerOptions,
  selectedProvider,
  onTagChange,
  onProviderChange,
  searchTerm,
  onSearchChange,
  onReset,
  className,
  isLoading,
}: TemplatesToolsProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'h-[6.5rem] flex items-center gap-[2rem]',
          '[&>div]:bg-surface3 [&>div]:w-[12rem] [&>div]:h-[2rem] [&>div]:animate-pulse',
          className,
        )}
      >
        <div /> <div /> <div />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap mx-auto sticky top-0 gap-[2rem] bg-surface2 py-[2rem]', className)}>
      <SearchField
        label="Search templates"
        value={searchTerm}
        onChange={e => onSearchChange?.(e.target.value)}
        placeholder="Search Template"
      />
      <SelectField label="Filter by tag" value={selectedTag} onValueChange={onTagChange} options={tagOptions} />
      <SelectField
        label="Filter by provider"
        value={selectedProvider}
        onValueChange={onProviderChange}
        options={providerOptions}
      />
      {onReset && (
        <Button onClick={onReset}>
          Reset <XIcon />
        </Button>
      )}
    </div>
  );
}
