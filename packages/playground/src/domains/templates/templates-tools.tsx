import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { cn } from '@mastra/playground-ui/utils/cn';
import { SearchIcon, XIcon } from 'lucide-react';

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
          'flex h-[6.5rem] items-center gap-5',
          '[&>div]:h-8 [&>div]:w-48 [&>div]:animate-pulse [&>div]:bg-card',
          className,
        )}
      >
        <div /> <div /> <div />
      </div>
    );
  }

  return (
    <div className={cn('sticky top-0 mx-auto flex flex-wrap gap-4 bg-background py-5', className)}>
      <Field>
        <FieldLabel className="sr-only">Search templates</FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            name="search-templates"
            value={searchTerm}
            onChange={e => onSearchChange?.(e.target.value)}
            placeholder="Search Template"
          />
        </InputGroup>
      </Field>
      <Select name="filter-tag" value={selectedTag} onValueChange={onTagChange}>
        <SelectTrigger aria-label="Filter by tag" size="md">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {tagOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select name="filter-provider" value={selectedProvider} onValueChange={onProviderChange}>
        <SelectTrigger aria-label="Filter by provider" size="md">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {providerOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onReset && (
        <Button onClick={onReset} icon={<XIcon />}>
          Reset
        </Button>
      )}
    </div>
  );
}
