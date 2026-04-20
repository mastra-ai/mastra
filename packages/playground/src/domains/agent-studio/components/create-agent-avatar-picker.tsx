import { Button, SubSectionRoot } from '@mastra/playground-ui';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useAgentStudioConfig } from '../hooks/use-agent-studio-config';
import { AgentAvatar } from './agent-avatar';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';

const MAX_BYTES = 512 * 1024; // 512 KB after downscaling
const ACCEPT = 'image/png,image/jpeg,image/webp';

export interface PendingAvatar {
  contentBase64: string;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  previewUrl: string;
}

async function downscaleToPendingAvatar(file: File): Promise<PendingAvatar> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

  const contentType: 'image/png' | 'image/jpeg' = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(contentType, 0.85);
  const contentBase64 = dataUrl.split(',')[1] ?? '';
  return { contentBase64, contentType, previewUrl: dataUrl };
}

export interface CreateAgentAvatarPickerProps {
  name: string;
  value: PendingAvatar | null;
  onChange: (value: PendingAvatar | null) => void;
}

/**
 * Avatar picker for the Agent Studio Create flow. The agent doesn't exist
 * yet, so we downscale locally and hold the base64 payload in parent state.
 * The parent uploads it via `onAfterCreate` once the agent id is known.
 */
export function CreateAgentAvatarPicker({ name, value, onChange }: CreateAgentAvatarPickerProps) {
  const { config } = useAgentStudioConfig();
  const allowAvatarUpload = config?.configure?.allowAvatarUpload !== false;

  const [isProcessing, setIsProcessing] = useState(false);

  const handleAvatarChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      setIsProcessing(true);
      try {
        const pending = await downscaleToPendingAvatar(file);
        const rawSize = Math.floor(pending.contentBase64.length * 0.75);
        if (rawSize > MAX_BYTES) {
          toast.error('Avatar is too large after downscaling. Try a smaller image.');
          return;
        }
        onChange(pending);
      } catch (error) {
        toast.error(`Avatar selection failed: ${(error as Error).message}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [onChange],
  );

  if (!allowAvatarUpload) return null;

  return (
    <SubSectionRoot>
      <SubSectionHeader title="Avatar" />
      <div className="flex items-start gap-4">
        <AgentAvatar name={name || 'Agent'} avatarUrl={value?.previewUrl} size={64} />
        <div className="flex flex-col gap-3 flex-1">
          <label className="text-xs text-icon4 flex items-center gap-2">
            <input
              type="file"
              accept={ACCEPT}
              onChange={event => void handleAvatarChange(event)}
              disabled={isProcessing}
              data-testid="agent-avatar-input"
              className="text-xs"
            />
            {isProcessing && <span>Processing…</span>}
          </label>
          {value && (
            <Button
              type="button"
              variant="light"
              size="sm"
              onClick={() => onChange(null)}
              data-testid="agent-avatar-clear"
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </SubSectionRoot>
  );
}
