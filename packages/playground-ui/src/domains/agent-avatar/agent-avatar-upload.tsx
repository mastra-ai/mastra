import { useRef } from 'react';

import { downscaleImageToDataUrl } from './downscale-avatar';
import { Avatar } from '@/ds/components/Avatar';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';
import { toast } from '@/utils/toast';

export interface AgentAvatarUploadProps {
  name: string;
  avatarUrl?: string;
  /** Receives a downscaled data URL. Omit to render the avatar read-only. */
  onChange?: (dataUrl: string) => void;
  disabled?: boolean;
  color?: string;
  textColor?: string;
  className?: string;
}

export const AgentAvatarUpload = ({
  name,
  avatarUrl,
  onChange,
  disabled = false,
  color,
  textColor,
  className,
}: AgentAvatarUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const interactive = !disabled && Boolean(onChange);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !interactive || !onChange) return;

    try {
      const { dataUrl } = await downscaleImageToDataUrl(file);
      onChange(dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process avatar image');
    }
  };

  return (
    <div
      className={cn('w-fit shrink-0 rounded-full bg-card p-1', className)}
      style={{ viewTransitionName: 'agent-avatar' }}
    >
      {interactive ? (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn('group relative rounded-full', focusRing)}
            aria-label="Upload avatar"
            data-testid="agent-configure-avatar-trigger"
          >
            <Avatar src={avatarUrl} name={name} size="lg" interactive color={color} textColor={textColor} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-muted/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <IconPlusMedium className="size-icon-lg text-foreground" />
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
          <Avatar src={avatarUrl} name={name} size="lg" color={color} textColor={textColor} />
        </div>
      )}
    </div>
  );
};
