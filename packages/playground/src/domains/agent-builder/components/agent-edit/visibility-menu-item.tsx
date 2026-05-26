import { DropdownMenu } from '@mastra/playground-ui';
import { Globe, LockIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useVisibilityChange } from '../../hooks/use-visibility-change-agent';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { Visibility } from './visibility-select';

export interface VisibilityMenuItemProps {
  agentId: string;
  disabled: boolean;
}

export function VisibilityMenuItem({ agentId, disabled }: VisibilityMenuItemProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const value = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;
  const { requestChange, dialog } = useVisibilityChange(agentId);

  return (
    <>
      {value === 'private' ? (
        <DropdownMenu.Item
          data-testid="agent-builder-mobile-menu-visibility-add"
          disabled={disabled}
          closeOnClick={false}
          onSelect={() => {
            requestChange('public');
          }}
        >
          <Globe />
          <span>Add to library</span>
        </DropdownMenu.Item>
      ) : (
        <DropdownMenu.Item
          data-testid="agent-builder-mobile-menu-visibility-remove"
          disabled={disabled}
          closeOnClick={false}
          onSelect={() => {
            requestChange('private');
          }}
        >
          <LockIcon />
          <span>Remove from library</span>
        </DropdownMenu.Item>
      )}
      {dialog}
    </>
  );
}
