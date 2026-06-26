import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { X } from 'lucide-react';

interface VersionIndicatorProps {
  versionNumber: number;
  onClose: () => void;
}

export function VersionIndicator({ versionNumber, onClose }: VersionIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="info">Viewing v{versionNumber}</Badge>
      <Button variant="ghost" size="icon-sm" onClick={onClose} tooltip="Back to latest version">
        <X />
      </Button>
    </div>
  );
}

// Keep the old export for backwards compatibility during transition
export const VersionPreviewBanner = VersionIndicator;
