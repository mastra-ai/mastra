import { Badge, IconButton } from '@mastra/playground-ui';
import { X } from 'lucide-react';

interface VersionIndicatorProps {
  versionNumber: number;
  onClose: () => void;
}

export function VersionIndicator({ versionNumber, onClose }: VersionIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="info">Viewing v{versionNumber}</Badge>
      <IconButton variant="ghost" size="sm" onClick={onClose} tooltip="Back to latest version">
        <X />
      </IconButton>
    </div>
  );
}

// Keep the old export for backwards compatibility during transition
export const VersionPreviewBanner = VersionIndicator;
