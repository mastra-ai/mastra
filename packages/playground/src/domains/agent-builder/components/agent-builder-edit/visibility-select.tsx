import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui';
import { BookOpenIcon, LockIcon } from 'lucide-react';
import { useState } from 'react';

export type Visibility = 'private' | 'shared';

export interface VisibilitySelectProps {
  defaultValue?: Visibility;
  onChange?: (value: Visibility) => void;
  disabled?: boolean;
}

export function VisibilitySelect({ defaultValue = 'private', onChange, disabled = false }: VisibilitySelectProps) {
  const [value, setValue] = useState<Visibility>(defaultValue);

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={next => {
        setValue(next as Visibility);
        onChange?.(next as Visibility);
      }}
    >
      <SelectTrigger size="sm" aria-label="Visibility" data-testid="agent-builder-visibility-trigger">
        <SelectValue placeholder="Visibility" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="private">
          <span className="flex items-center gap-2">
            <LockIcon className="h-3.5 w-3.5" />
            Private
          </span>
        </SelectItem>
        <SelectItem value="shared">
          <span className="flex items-center gap-2">
            <BookOpenIcon className="h-3.5 w-3.5" />
            Shared in Library
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
