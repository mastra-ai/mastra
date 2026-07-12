import { Button } from '@mastra/playground-ui/components/Button';
import { Globe, LockIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useVisibilityChange } from '../../hooks/use-visibility-change-agent';
import type { AgentBuilderEditFormValues } from '../../schemas';

export type Visibility = 'private' | 'public';

export interface VisibilitySelectProps {
  agentId: string;
}

export function VisibilitySelect({ agentId }: VisibilitySelectProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const watchValue = useWatch({ control: formMethods.control, name: 'visibility' });
  const { requestChange, dialog } = useVisibilityChange(agentId);

  const value = watchValue ?? 'private';

  return (
    <>
      {value === 'private' ? (
        <Button
          size="sm"
          variant="default"
          onClick={() => requestChange('public')}
          data-testid="agent-builder-visibility-add"
        >
          <Globe className="size-3.5" />
          Add to library
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => requestChange('private')}
          data-testid="agent-builder-visibility-remove"
        >
          <LockIcon className="size-3.5" />
          Remove from library
        </Button>
      )}
      {dialog}
    </>
  );
}
