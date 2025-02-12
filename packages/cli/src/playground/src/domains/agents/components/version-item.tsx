import { ChevronRight } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { PromptVersion } from '../types';

import { VersionActions } from './version-actions';

interface VersionItemProps {
  version: PromptVersion;
  index: number;
  isExpanded: boolean;
  isAnalysisExpanded: boolean;
  isUpdating: boolean;
  copiedVersions: Record<string | number, boolean>;
  onToggleExpand: (index: number) => void;
  onToggleAnalysis: (index: number) => void;
  onCopy: (content: string, key: string | number) => Promise<void>;
  onSetActive: (version: PromptVersion, index: number) => Promise<void>;
  onDelete: (index: number) => void;
}

export function VersionItem({
  version,
  index,
  isExpanded,
  isAnalysisExpanded,
  isUpdating,
  copiedVersions,
  onToggleExpand,
  onToggleAnalysis,
  onCopy,
  onSetActive,
  onDelete,
}: VersionItemProps) {
  return (
    <div
      className={`rounded-md border ${isExpanded ? 'border-mastra-purple/30' : 'border-mastra-bg-3'} bg-mastra-bg-2`}
    >
      <div
        className="p-2 flex items-center justify-between cursor-pointer hover:bg-mastra-bg-3/50"
        onClick={() => onToggleExpand(index)}
      >
        <div className="flex items-center space-x-2">
          <ChevronRight
            className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90 text-mastra-purple' : ''}`}
          />
          <div>
            <div className="flex items-center space-x-2">
              <p className="text-xs font-medium text-mastra-el-4">Version {index + 1}</p>
              {version.status === 'active' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">Active</span>
              )}
              {version.status === 'original' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-500">Original</span>
              )}
              {version.status === 'draft' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">Draft</span>
              )}
            </div>
            <p className="text-[10px] text-mastra-el-3">{version.timestamp.toLocaleString()}</p>
          </div>
        </div>
        <VersionActions
          version={version}
          index={index}
          isUpdating={isUpdating}
          isAnalysisExpanded={isAnalysisExpanded === index}
          onSetActive={onSetActive}
          onDelete={onDelete}
          onToggleAnalysis={onToggleAnalysis}
        />
      </div>
      {(isExpanded || isAnalysisExpanded) && (
        <div className="px-2 pb-2 space-y-2">
          {isAnalysisExpanded && version.analysis && (
            <Alert className="py-1.5 bg-transparent border-none">
              <AlertDescription className="text-[10px] text-mastra-el-4">{version.analysis}</AlertDescription>
            </Alert>
          )}
          {isExpanded && (
            <ScrollArea className="h-[150px] rounded-md border border-mastra-bg-3">
              <div
                className="p-2 cursor-pointer hover:bg-mastra-bg-3/50 transition-colors group"
                onClick={e => {
                  e.stopPropagation();
                  // Show copied immediately
                  const content = version.content;
                  navigator.clipboard
                    .writeText(content)
                    .then(() => {
                      onCopy(content, index);
                    })
                    .catch(console.error);
                }}
              >
                <pre className="text-xs whitespace-pre-wrap font-mono relative">
                  {version.content}
                  {copiedVersions[index] && (
                    <span className="absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">
                      Copied!
                    </span>
                  )}
                  <span className="absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-full bg-mastra-bg-3 text-mastra-el-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to copy
                  </span>
                </pre>
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
