import { Button, DropdownMenu } from '@mastra/playground-ui';
import { Globe, LockIcon, MoreVerticalIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useVisibilityChange } from './use-visibility-change';
import type { Visibility } from './visibility-select';
import type { SkillEditFormValues } from '@/domains/agent-builder/hooks/use-autosave-skill';

export interface SkillBuilderMobileMenuProps {
  skillId: string;
  /** When true, includes the Add/Remove from library item. Owner-only. */
  showSetVisibility?: boolean;
  /** Disables all actions (e.g. during streaming). */
  disabled?: boolean;
}

export function SkillBuilderMobileMenu({
  skillId,
  showSetVisibility = false,
  disabled = false,
}: SkillBuilderMobileMenuProps) {
  if (!showSetVisibility) return null;

  return (
    <div className="lg:hidden" data-testid="skill-builder-mobile-menu">
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button size="icon-sm" variant="ghost" tooltip="More actions" data-testid="skill-builder-mobile-menu-trigger">
            <MoreVerticalIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <VisibilityMenuItem skillId={skillId} disabled={disabled} />
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}

interface VisibilityMenuItemProps {
  skillId: string;
  disabled: boolean;
}

function VisibilityMenuItem({ skillId, disabled }: VisibilityMenuItemProps) {
  const formMethods = useFormContext<SkillEditFormValues>();
  const value = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;
  const { requestChange, dialog } = useVisibilityChange(skillId);

  return (
    <>
      {value === 'private' ? (
        <DropdownMenu.Item
          data-testid="skill-builder-mobile-menu-visibility-add"
          disabled={disabled}
          onSelect={event => {
            event.preventDefault();
            requestChange('public');
          }}
        >
          <Globe />
          <span>Add to library</span>
        </DropdownMenu.Item>
      ) : (
        <DropdownMenu.Item
          data-testid="skill-builder-mobile-menu-visibility-remove"
          disabled={disabled}
          onSelect={event => {
            event.preventDefault();
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
