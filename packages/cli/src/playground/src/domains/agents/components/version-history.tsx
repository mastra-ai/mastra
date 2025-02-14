import { useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';

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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <h3 className="text-sm font-medium text-mastra-el-5">Version History</h3>
          <p className="text-xs text-mastra-el-3">Previous versions of the instructions</p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {versions.map((version, index) => (
            <VersionItem
              key={index}
              version={version}
              index={index}
              isExpanded={expandedVersion === index}
              isAnalysisExpanded={expandedAnalysis}
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
      </ScrollArea>
    </div>
  );
}
