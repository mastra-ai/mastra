import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import { Button } from '@/ds/components/Button';
import { X } from 'lucide-react';

interface VersionPreviewBannerProps {
  versionNumber: number;
  onClose: () => void;
}

export function VersionPreviewBanner({ versionNumber, onClose }: VersionPreviewBannerProps) {
  return (
    <Alert variant="info" className="mx-4 mt-4 mb-0">
      <div className="flex items-center justify-between w-full">
        <div>
          <AlertTitle>Viewing Version {versionNumber}</AlertTitle>
          <AlertDescription as="p">You are viewing a previous version. This form is read-only.</AlertDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="flex items-center gap-1.5 shrink-0 ml-4">
          <X className="h-3.5 w-3.5" />
          Back to current
        </Button>
      </div>
    </Alert>
  );
}
