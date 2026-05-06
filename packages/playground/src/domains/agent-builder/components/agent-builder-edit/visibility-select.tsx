import { Button } from '@mastra/playground-ui';
import { Globe, LockIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { useVisibilityChange } from './use-visibility-change';

export type Visibility = 'private' | 'public';

export interface VisibilitySelectProps {
  agentId: string;
}

export function VisibilitySelect({ agentId }: VisibilitySelectProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const value = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;
  const { requestChange, dialog } = useVisibilityChange(agentId);

  return (
    <>
      {value === 'private' ? (
        <Button
          size="sm"
          variant="default"
          onClick={() => requestChange('public')}
          data-testid="agent-builder-visibility-add"
        >
          <Globe className="h-3.5 w-3.5" />
          Add to library
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => requestChange('private')}
          data-testid="agent-builder-visibility-remove"
        >
          <LockIcon className="h-3.5 w-3.5" />
          Remove from library
        </Button>
      )}
      {dialog}
    </>
  );
}
