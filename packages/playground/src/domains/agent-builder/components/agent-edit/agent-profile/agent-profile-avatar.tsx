import { Avatar, toast } from '@mastra/playground-ui';
import { Plus } from 'lucide-react';
import { useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { downscaleImageToDataUrl } from '../../../services/downscale-avatar';

export interface AgentProfileAvatarProps {
  /** Display fallback name (e.g. the agent's saved name when read-only). */
  fallbackName?: string;
  /** Display fallback avatar URL when no draft avatar is present. */
  fallbackAvatarUrl?: string;
  /** Whether the avatar can be replaced by the user. */
  editable?: boolean;
  /** Whether the upload trigger should be disabled (e.g. while a stream is running). */
  disabled?: boolean;
}

export const AgentProfileAvatar = ({
  fallbackName,
  fallbackAvatarUrl,
  editable = true,
  disabled = false,
}: AgentProfileAvatarProps) => {
  const features = useBuilderAgentFeatures();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();

  const draftName = useWatch({ control, name: 'name' }) ?? '';
  const draftAvatarUrl = useWatch({ control, name: 'avatarUrl' });

  const displayedName = editable ? draftName : (fallbackName ?? draftName);
  const displayedAvatarUrl = editable ? draftAvatarUrl : (fallbackAvatarUrl ?? draftAvatarUrl);

  const interactive = editable && !disabled && features.avatarUpload;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !interactive) return;

    try {
      const { dataUrl } = await downscaleImageToDataUrl(file);
      setValue('avatarUrl', dataUrl, { shouldDirty: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process avatar image');
    }
  };

  return (
    <div className="py-2 scale-150 origin-center">
      {interactive ? (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral3 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Upload avatar"
            data-testid="agent-configure-avatar-trigger"
          >
            <Avatar src={displayedAvatarUrl} name={displayedName || 'A'} size="lg" interactive />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-surface4 opacity-0 transition-opacity">
              <Plus className="h-5 w-5 text-neutral5" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFile}
            className="hidden"
            data-testid="agent-configure-avatar-input"
          />
        </>
      ) : (
        <div data-testid="agent-configure-avatar-display">
          <Avatar src={displayedAvatarUrl} name={displayedName || 'A'} size="lg" />
        </div>
      )}
    </div>
  );
};
