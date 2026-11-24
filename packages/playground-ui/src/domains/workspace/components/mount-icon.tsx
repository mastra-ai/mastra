import type { WorkspaceFsListResponse } from '@mastra/client-js';
import { AmazonIcon, AzureIcon, GoogleIcon } from '@/ds/icons';
import { IconCloud } from '@/ds/icons/central/IconCloud';
import { IconFolder1 } from '@/ds/icons/central/IconFolder1';
import { IconServer1 } from '@/ds/icons/central/IconServer1';
import { IconStorage } from '@/ds/icons/central/IconStorage';

export type WorkspaceMount = NonNullable<WorkspaceFsListResponse['entries'][number]['mount']>;

/** Provider glyph for a mounted folder; falls back to a generic cloud. */
export function MountIcon({ mount }: { mount: WorkspaceMount }) {
  switch (mount.icon || mount.provider) {
    case 'aws-s3':
    case 's3':
      return <AmazonIcon className="text-foreground" />;
    case 'google-cloud':
    case 'google-cloud-storage':
    case 'gcs':
      return <GoogleIcon />;
    case 'azure-blob':
    case 'azure':
      return <AzureIcon className="text-badge-blue-indicator" />;
    case 'cloudflare':
    case 'cloudflare-r2':
    case 'r2':
      return <IconCloud className="text-badge-orange-indicator" />;
    case 'neon':
      return <IconCloud className="text-badge-green-indicator" />;
    case 'minio':
      return <IconStorage className="text-badge-red-indicator" />;
    case 'database':
      return <IconServer1 className="text-badge-green-indicator" />;
    case 'local':
    case 'folder':
      return <IconFolder1 className="text-badge-amber-indicator" />;
    case 'hard-drive':
      return <IconStorage className="text-muted-foreground" />;
    default:
      return <IconCloud className="text-muted-foreground" />;
  }
}
