import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui';
import { Globe, LockIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';

export type Visibility = 'private' | 'public';

export interface VisibilitySelectProps {
  disabled?: boolean;
  variant?: ComponentProps<typeof SelectTrigger>['variant'];
}

export function VisibilitySelect({ disabled = false, variant = 'inputLike' }: VisibilitySelectProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const value = useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private';

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={next => {
        formMethods.setValue('visibility', next as Visibility, { shouldDirty: true });
      }}
    >
      <SelectTrigger size="sm" variant={variant} aria-label="Visibility" data-testid="agent-builder-visibility-trigger">
        <SelectValue placeholder="Visibility" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="private">
          <span className="flex items-center gap-2">
            <LockIcon className="h-3.5 w-3.5" />
            Private
          </span>
        </SelectItem>
        <SelectItem value="public">
          <span className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            Public
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
