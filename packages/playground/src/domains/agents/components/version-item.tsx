import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { CodeDisplay } from '@/components/ui/code-display';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

import type { PromptVersion } from '../types';

import { VersionActions } from './version-actions';

interface VersionItemProps {
  version: PromptVersion;
  index: number;
  isExpanded: boolean;
  isAnalysisExpanded: number | null;
  isUpdating: boolean;
  copiedVersions: Record<string | number, boolean>;
  onToggleExpand: () => void;
  onToggleAnalysis: () => void;
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
  onToggleExpand,
  onToggleAnalysis,
  onSetActive,
  onDelete,
}: VersionItemProps) {
  const [showEvals, setShowEvals] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { handleCopy, isCopied } = useCopyToClipboard({
    text: version.content,
  });

  const formatText = (text: string) => {
    return text.replace(/\\n/g, '\n');
  };

  return (
    <div
      className={`rounded-md border ${isExpanded ? 'border-mastra-purple/30' : 'border-mastra-bg-3'} bg-mastra-bg-2`}
    >
      <div
        className="p-2 flex items-center justify-between cursor-pointer hover:bg-mastra-bg-3/50"
        onClick={onToggleExpand}
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
      {isExpanded && (
        <ScrollArea className="h-[250px]">
          <div className="px-2 pb-2 space-y-2">
            <div>
              <div
                className="flex items-center space-x-1 cursor-pointer hover:bg-mastra-bg-3/50 p-1 rounded-md mb-2"
                onClick={e => {
                  e.stopPropagation();
                  setShowInstructions(!showInstructions);
                }}
              >
                <ChevronRight className={`h-3 w-3 transition-transform ${showInstructions ? 'rotate-90' : ''}`} />
                <p className="text-xs font-medium text-mastra-el-4">Instructions</p>
              </div>
              {showInstructions && (
                <div className="rounded-md border border-mastra-bg-3">
                  <div className="mt-2">
                    <CodeDisplay content={formatText(version.content)} isCopied={isCopied} onCopy={handleCopy} />
                  </div>
                </div>
              )}
            </div>

            {version.analysis && (
              <div>
                <div
                  className="flex items-center space-x-1 cursor-pointer hover:bg-mastra-bg-3/50 p-1 rounded-md mb-2"
                  onClick={e => {
                    e.stopPropagation();
                    setShowAnalysis(!showAnalysis);
                  }}
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${showAnalysis ? 'rotate-90' : ''}`} />
                  <p className="text-xs font-medium text-mastra-el-4">Analysis</p>
                </div>
                {showAnalysis && (
                  <div className="rounded-md border border-mastra-bg-3">
                    <div className="p-2">
                      <pre className="text-[10px] text-mastra-el-4 whitespace-pre-wrap font-mono">
                        {formatText(version.analysis || '')}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {version.evals && version.evals.length > 0 && (
              <div className="space-y-1">
                <div
                  className="flex items-center space-x-1 cursor-pointer hover:bg-mastra-bg-3/50 p-1 rounded-md"
                  onClick={e => {
                    e.stopPropagation();
                    setShowEvals(!showEvals);
                  }}
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${showEvals ? 'rotate-90' : ''}`} />
                  <p className="text-xs font-medium text-mastra-el-4">Evaluations ({version.evals.length})</p>
                </div>
                {showEvals && (
                  <div className="pl-4">
                    <div className="space-y-1 pr-4">
                      {version.evals.map((metric, evalIndex) => (
                        <div key={evalIndex} className="rounded-md border border-mastra-bg-3 p-1.5 text-[10px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-1.5 py-0.5 rounded-full min-w-[32px] text-center ${
                                  metric.result.score >= 0.7
                                    ? 'bg-green-500/20 text-green-500'
                                    : metric.result.score >= 0.4
                                      ? 'bg-yellow-500/20 text-yellow-500'
                                      : 'bg-red-500/20 text-red-500'
                                }`}
                              >
                                {metric.result.score.toFixed(2)}
                              </span>
                              <span className="text-mastra-el-3 text-[9px]">
                                {new Date(metric.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 space-y-1">
                            <div className="flex gap-1.5">
                              <span className="text-mastra-el-3 shrink-0">→</span>
                              <span className="text-mastra-el-4">{metric.input}</span>
                            </div>
                            <div className="flex gap-1.5">
                              <span className="text-mastra-el-3 shrink-0">←</span>
                              <span className="text-mastra-el-4">{metric.output}</span>
                            </div>
                            <div className="flex gap-1.5 text-[9px] text-mastra-el-3">
                              <span className="shrink-0">⚬</span>
                              <span>{metric.result.info.reason}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
