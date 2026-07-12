import { Button } from '@mastra/playground-ui/components/Button';
import { SearchFieldBlock, SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { cn } from '@mastra/playground-ui/utils/cn';
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
          'h-26 flex items-center gap-8',
          '[&>div]:h-8 [&>div]:w-48 [&>div]:animate-pulse [&>div]:bg-surface3',
          className,
        )}
      >
        <div /> <div /> <div />
      </div>
    );
  }

  return (
    <div className={cn('sticky top-0 mx-auto flex flex-wrap gap-4 bg-surface2 py-8', className)}>
      <SearchFieldBlock
        name="search-templates"
        label="Search templates"
        labelIsHidden
        value={searchTerm}
        onChange={e => onSearchChange?.(e.target.value)}
        placeholder="Search Template"
      />
      <SelectFieldBlock
        label="Filter by tag"
        labelIsHidden={true}
        name="filter-tag"
        value={selectedTag}
        onValueChange={onTagChange}
        options={tagOptions}
      />
      <SelectFieldBlock
        label="Filter by provider"
        labelIsHidden={true}
        name="filter-provider"
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
