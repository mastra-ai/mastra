'use client';

import { useState } from 'react';
import { useScorerVersions } from '../../hooks/use-stored-scorers';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';

interface ScorerVersionCompareDialogProps {
  scorerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Simplified version compare dialog for scorers
 * Shows side-by-side comparison of two versions
 */
export function ScorerVersionCompareDialog({ scorerId, open, onOpenChange }: ScorerVersionCompareDialogProps) {
  const [fromVersionId, setFromVersionId] = useState('');
  const [toVersionId, setToVersionId] = useState('');

  const { data } = useScorerVersions(scorerId, { page: 0, perPage: 50 });
  const versions = data?.versions || [];

  const handleClose = () => {
    setFromVersionId('');
    setToVersionId('');
    onOpenChange(false);
  };

  // Get selected versions for comparison
  const fromVersion = versions.find(v => v.id === fromVersionId);
  const toVersion = versions.find(v => v.id === toVersionId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="from-version" className="text-icon5">
                From Version
              </Label>
              <select
                id="from-version"
                value={fromVersionId}
                onChange={e => setFromVersionId(e.target.value)}
                className="flex w-full text-icon6 rounded-lg border bg-transparent shadow-sm transition-colors border-sm border-border1 px-3 py-2 text-sm"
              >
                <option value="">Select version...</option>
                {versions.map(version => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber}
                    {version.name ? ` - ${version.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="to-version" className="text-icon5">
                To Version
              </Label>
              <select
                id="to-version"
                value={toVersionId}
                onChange={e => setToVersionId(e.target.value)}
                className="flex w-full text-icon6 rounded-lg border bg-transparent shadow-sm transition-colors border-sm border-border1 px-3 py-2 text-sm"
              >
                <option value="">Select version...</option>
                {versions.map(version => (
                  <option key={version.id} value={version.id}>
                    v{version.versionNumber}
                    {version.name ? ` - ${version.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {fromVersion && toVersion && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border1">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-icon6">
                  v{fromVersion.versionNumber}
                  {fromVersion.name && ` - ${fromVersion.name}`}
                </h4>
                {fromVersion.changedFields && fromVersion.changedFields.length > 0 && (
                  <p className="text-xs text-icon3">Changed: {fromVersion.changedFields.join(', ')}</p>
                )}
                {fromVersion.changeMessage && <p className="text-xs text-icon3 mt-1">{fromVersion.changeMessage}</p>}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-icon6">
                  v{toVersion.versionNumber}
                  {toVersion.name && ` - ${toVersion.name}`}
                </h4>
                {toVersion.changedFields && toVersion.changedFields.length > 0 && (
                  <p className="text-xs text-icon3">Changed: {toVersion.changedFields.join(', ')}</p>
                )}
                {toVersion.changeMessage && <p className="text-xs text-icon3 mt-1">{toVersion.changeMessage}</p>}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
