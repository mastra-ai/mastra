import type { WorkspaceFsListResponse } from '@mastra/client-js';
import { Cloud, Database, Folder, HardDrive } from 'lucide-react';
import { AmazonIcon, AzureIcon, GoogleIcon } from '@/ds/icons';

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
      return <Cloud className="text-badge-orange-indicator" />;
    case 'minio':
      return <HardDrive className="text-badge-red-indicator" />;
    case 'database':
      return <Database className="text-badge-green-indicator" />;
    case 'local':
    case 'folder':
      return <Folder className="text-badge-amber-indicator" />;
    case 'hard-drive':
      return <HardDrive className="text-muted-foreground" />;
    default:
      return <Cloud className="text-muted-foreground" />;
  }
}
