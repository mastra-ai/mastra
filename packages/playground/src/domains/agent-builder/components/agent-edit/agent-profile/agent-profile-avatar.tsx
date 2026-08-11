import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { toast } from '@mastra/playground-ui/utils/toast';
import { Plus } from 'lucide-react';
import { useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useAgentColor } from '../../../contexts/agent-color-context';
import { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { downscaleImageToDataUrl } from '../../../services/downscale-avatar';

export interface AgentProfileAvatarProps {
  disabled?: boolean;
}

export const AgentProfileAvatar = ({ disabled = false }: AgentProfileAvatarProps) => {
  const features = useBuilderAgentFeatures();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const draftName = useWatch({ control, name: 'name' }) ?? '';
  const draftAvatarUrl = useWatch({ control, name: 'avatarUrl' });
  const agentColor = useAgentColor();

  const interactive = !disabled && features.avatarUpload;
  const avatarColor = agentColor.background;
  const avatarTextColor = agentColor.foreground;

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
    <div className="bg-surface3 scale-[1.65] rounded-full p-1" style={{ viewTransitionName: 'agent-avatar' }}>
      {interactive ? (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="focus-visible:ring-neutral3 relative rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Upload avatar"
            data-testid="agent-configure-avatar-trigger"
          >
            <Avatar
              src={draftAvatarUrl}
              name={draftName}
              size="lg"
              interactive
              color={avatarColor}
              textColor={avatarTextColor}
            />
            <span className="bg-surface4 absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity">
              <Plus className="text-neutral5 h-5 w-5" />
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
          <Avatar src={draftAvatarUrl} name={draftName} size="lg" color={avatarColor} textColor={avatarTextColor} />
        </div>
      )}
    </div>
  );
};
