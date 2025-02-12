import { useState } from 'react';

import type { PromptVersion } from '../types';

import { VersionItem } from './version-item';

interface VersionHistoryProps {
  versions: PromptVersion[];
  isUpdating: boolean;
  copiedVersions: Record<string | number, boolean>;
  onCopy: (content: string, key: string | number) => Promise<void>;
  onSetActive: (version: PromptVersion, index: number) => Promise<void>;
  onDelete: (index: number) => void;
}

export function VersionHistory({
  versions,
  isUpdating,
  copiedVersions,
  onCopy,
  onSetActive,
  onDelete,
}: VersionHistoryProps) {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<number | null>(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <h3 className="text-sm font-medium text-mastra-el-5">Version History</h3>
          <p className="text-xs text-mastra-el-3">Previous versions of the instructions</p>
        </div>
      </div>
      <div className="space-y-1">
        {versions.map((version, index) => (
          <VersionItem
            key={index}
            version={version}
            index={index}
            isExpanded={expandedVersion === index}
            isAnalysisExpanded={expandedAnalysis === index}
            isUpdating={isUpdating}
            copiedVersions={copiedVersions}
            onToggleExpand={() => {
              if (expandedVersion === index) {
                return setExpandedVersion(null);
              }
              setExpandedVersion(index);
            }}
            onToggleAnalysis={() => {
              if (expandedAnalysis === index) {
                return setExpandedAnalysis(null);
              }
              setExpandedAnalysis(index);
            }}
            onCopy={onCopy}
            onSetActive={onSetActive}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
