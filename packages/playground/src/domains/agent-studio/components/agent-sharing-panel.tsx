import { Button, SubSectionRoot } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useAgentStudioConfig } from '../hooks/use-agent-studio-config';
import { AgentAvatar } from './agent-avatar';
import { resolveAgentAvatar } from './avatar';
import { resolveVisibility } from './visibility';
import { VisibilityBadge } from './visibility-badge';
import { useStoredAgent, useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';

const MAX_BYTES = 512 * 1024; // 512 KB after downscaling
const ACCEPT = 'image/png,image/jpeg,image/webp';

/** Downscale + re-encode the file to 256x256 PNG/JPEG and return base64. */
async function downscaleToBase64(
  file: File,
): Promise<{ contentBase64: string; contentType: 'image/png' | 'image/jpeg' | 'image/webp' }> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  // Center-crop to square.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

  const contentType: 'image/png' | 'image/jpeg' = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(contentType, 0.85);
  const contentBase64 = dataUrl.split(',')[1] ?? '';
  return { contentBase64, contentType };
}

export interface AgentSharingPanelProps {
  agentId: string;
}

export function AgentSharingPanel({ agentId }: AgentSharingPanelProps) {
  const { data: storedAgent } = useStoredAgent(agentId);
  const { updateStoredAgent } = useStoredAgentMutations(agentId);
  const { config } = useAgentStudioConfig();
  const client = useMastraClient();

  const [isUploading, setIsUploading] = useState(false);

  const visibility = useMemo(() => storedAgent?.visibility ?? resolveVisibility(storedAgent?.metadata), [storedAgent]);
  const avatarUrl = storedAgent ? resolveAgentAvatar(storedAgent) : undefined;

  const allowSharing = config?.marketplace?.allowSharing !== false;
  const allowAvatarUpload = config?.configure?.allowAvatarUpload !== false;

  const handleToggleVisibility = useCallback(async () => {
    if (!storedAgent) return;
    const next = visibility === 'public' ? 'private' : 'public';
    try {
      await updateStoredAgent.mutateAsync({
        metadata: { ...(storedAgent.metadata ?? {}), visibility: next },
      });
      toast.success(next === 'public' ? 'Shared to Marketplace' : 'Removed from Marketplace');
    } catch (error) {
      toast.error(`Failed to update visibility: ${(error as Error).message}`);
    }
  }, [storedAgent, updateStoredAgent, visibility]);

  const handleAvatarChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !agentId) return;
      setIsUploading(true);
      try {
        const { contentBase64, contentType } = await downscaleToBase64(file);
        const rawSize = Math.floor(contentBase64.length * 0.75);
        if (rawSize > MAX_BYTES) {
          toast.error('Avatar is too large after downscaling. Try a smaller image.');
          return;
        }
        await client.getStoredAgent(agentId).uploadAvatar({ contentBase64, contentType });
        toast.success('Avatar updated');
      } catch (error) {
        toast.error(`Avatar upload failed: ${(error as Error).message}`);
      } finally {
        setIsUploading(false);
      }
    },
    [agentId, client],
  );

  if (!storedAgent) return null;

  return (
    <SubSectionRoot>
      <SubSectionHeader title="Sharing & avatar" />
      <div className="flex items-start gap-4">
        <AgentAvatar name={storedAgent.name} avatarUrl={avatarUrl} size={64} />
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2">
            <VisibilityBadge visibility={visibility} showLabel />
            {allowSharing && (
              <Button
                variant="light"
                size="sm"
                onClick={() => void handleToggleVisibility()}
                disabled={updateStoredAgent.isPending}
                data-testid="agent-share-toggle"
              >
                {visibility === 'public' ? 'Make private' : 'Share to Marketplace'}
              </Button>
            )}
          </div>
          {allowAvatarUpload && (
            <label className="text-xs text-icon4 flex items-center gap-2">
              <input
                type="file"
                accept={ACCEPT}
                onChange={event => void handleAvatarChange(event)}
                disabled={isUploading}
                data-testid="agent-avatar-input"
                className="text-xs"
              />
              {isUploading && <span>Uploading…</span>}
            </label>
          )}
        </div>
      </div>
    </SubSectionRoot>
  );
}
