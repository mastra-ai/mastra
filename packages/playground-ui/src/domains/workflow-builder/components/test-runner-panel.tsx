import { useState } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  PauseCircle,
  Coins,
  Zap,
  History,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ds/components/Button';
import { useTestRunnerStore, type TestRunResult, type StepResult, type StepStatus } from '../store/test-runner-store';

// ============================================================================
// Props
// ============================================================================

export interface TestRunnerPanelProps {
  className?: string;
  onRunTest?: (input: Record<string, unknown>) => Promise<void>;
}

// ============================================================================
// Helper Components
// ============================================================================

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4 text-icon3" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'suspended':
      return <PauseCircle className="w-4 h-4 text-amber-400" />;
    case 'skipped':
      return <ChevronRight className="w-4 h-4 text-icon3" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

function StepResultRow({
  step,
  isExpanded,
  onToggle,
}: {
  step: StepResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border1 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface3 transition-colors"
      >
        <StatusIcon status={step.status} />
        <span className="text-xs font-medium text-icon5 flex-1 text-left truncate">{step.stepId}</span>
        {step.durationMs && <span className="text-[10px] text-icon3 font-mono">{formatDuration(step.durationMs)}</span>}
        {step.aiMetrics?.totalTokens && (
          <span className="text-[10px] text-purple-400 font-mono">{step.aiMetrics.totalTokens} tok</span>
        )}
        {isExpanded ? <ChevronDown className="w-4 h-4 text-icon3" /> : <ChevronRight className="w-4 h-4 text-icon3" />}
      </button>

      {isExpanded && (
        <div className="px-3 py-2 bg-surface2 text-xs space-y-2">
          {step.error && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400">{step.error}</div>
          )}
          {step.output !== undefined && (
            <div>
              <div className="text-[10px] text-icon3 uppercase mb-1">Output</div>
              <pre className="p-2 bg-surface4 rounded overflow-x-auto text-icon4 font-mono text-[10px]">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
          {step.aiMetrics && (
            <div className="flex items-center gap-3 text-[10px] text-icon3">
              {step.aiMetrics.model && <span>Model: {step.aiMetrics.model}</span>}
              {step.aiMetrics.promptTokens && <span>Prompt: {step.aiMetrics.promptTokens}</span>}
              {step.aiMetrics.completionTokens && <span>Completion: {step.aiMetrics.completionTokens}</span>}
              {step.aiMetrics.cost && <span>Cost: ${step.aiMetrics.cost.toFixed(4)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunSummary({ run }: { run: TestRunResult }) {
  const statusColors: Record<TestRunResult['status'], string> = {
    running: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    suspended: 'text-amber-400',
  };

  const statusLabels: Record<TestRunResult['status'], string> = {
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    suspended: 'Waiting for Input',
  };

  const stepCount = Object.keys(run.steps).length;
  const completedSteps = Object.values(run.steps).filter(s => s.status === 'completed').length;
  const failedSteps = Object.values(run.steps).filter(s => s.status === 'failed').length;

  return (
    <div className="p-3 bg-surface2 border-b border-border1">
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-sm font-medium', statusColors[run.status])}>{statusLabels[run.status]}</span>
        {run.durationMs && <span className="text-xs text-icon3 font-mono">{formatDuration(run.durationMs)}</span>}
      </div>

      <div className="flex items-center gap-4 text-xs text-icon4">
        <span>
          Steps: {completedSteps}/{stepCount}
        </span>
        {failedSteps > 0 && <span className="text-red-400">{failedSteps} failed</span>}
        {run.totalAiMetrics && (
          <>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {run.totalAiMetrics.totalTokens} tokens
            </span>
            <span className="flex items-center gap-1">
              <Coins className="w-3 h-3" />${run.totalAiMetrics.totalCost.toFixed(4)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryItem({ run, onClick }: { run: TestRunResult; onClick: () => void }) {
  const statusColors: Record<TestRunResult['status'], string> = {
    running: 'bg-blue-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    suspended: 'bg-amber-500',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface3 transition-colors text-left"
    >
      <div className={cn('w-2 h-2 rounded-full', statusColors[run.status])} />
      <span className="text-xs text-icon4 flex-1 truncate">{formatTimestamp(run.startedAt)}</span>
      {run.durationMs && <span className="text-[10px] text-icon3 font-mono">{formatDuration(run.durationMs)}</span>}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TestRunnerPanel({ className, onRunTest }: TestRunnerPanelProps) {
  const isOpen = useTestRunnerStore(state => state.isOpen);
  const isRunning = useTestRunnerStore(state => state.isRunning);
  const currentRun = useTestRunnerStore(state => state.currentRun);
  const runHistory = useTestRunnerStore(state => state.runHistory);
  const testInput = useTestRunnerStore(state => state.testInput);

  const setOpen = useTestRunnerStore(state => state.setOpen);
  const setShowInputModal = useTestRunnerStore(state => state.setShowInputModal);
  const cancelRun = useTestRunnerStore(state => state.cancelRun);
  const clearRun = useTestRunnerStore(state => state.clearRun);

  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleRun = async () => {
    if (onRunTest) {
      await onRunTest(testInput);
    } else {
      setShowInputModal(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={cn('flex flex-col bg-surface1 border-l border-border1 w-[350px]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border1">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-icon4" />
          <span className="text-sm font-medium text-icon5">Test Runner</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={cn('p-1.5 rounded hover:bg-surface3', showHistory && 'bg-surface3')}
            title="Run history"
          >
            <History className="w-4 h-4 text-icon3" />
          </button>
          <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-surface3">
            <X className="w-4 h-4 text-icon3" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 p-3 border-b border-border1">
        {isRunning ? (
          <Button variant="outline" size="md" onClick={cancelRun} className="flex-1 text-red-400 border-red-500/50">
            <Square className="w-4 h-4 mr-1" />
            Stop
          </Button>
        ) : (
          <Button variant="default" size="md" onClick={handleRun} className="flex-1">
            <Play className="w-4 h-4 mr-1" />
            Run Test
          </Button>
        )}
        {currentRun && !isRunning && (
          <Button variant="ghost" size="md" onClick={clearRun}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="border-b border-border1">
          <div className="px-3 py-2 text-xs text-icon3 bg-surface2">Recent Runs</div>
          {runHistory.length > 0 ? (
            <div className="max-h-[150px] overflow-y-auto">
              {runHistory.map(run => (
                <HistoryItem key={run.runId} run={run} onClick={() => {}} />
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-xs text-icon3 text-center">No previous runs</div>
          )}
        </div>
      )}

      {/* Current Run */}
      <div className="flex-1 overflow-y-auto">
        {currentRun ? (
          <>
            <RunSummary run={currentRun} />

            {/* Suspend Info */}
            {currentRun.status === 'suspended' && currentRun.suspend && (
              <div className="p-3 bg-amber-500/10 border-b border-amber-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <PauseCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Waiting for Human Input</span>
                </div>
                <p className="text-xs text-icon4">Step "{currentRun.suspend.stepId}" requires input to continue.</p>
                <Button variant="default" size="md" className="mt-2 w-full" onClick={() => setShowInputModal(true)}>
                  Provide Input
                </Button>
              </div>
            )}

            {/* Step Results */}
            <div>
              {Object.values(currentRun.steps).map(step => (
                <StepResultRow
                  key={step.stepId}
                  step={step}
                  isExpanded={expandedSteps.has(step.stepId)}
                  onToggle={() => toggleStep(step.stepId)}
                />
              ))}
            </div>

            {/* Final Output */}
            {currentRun.output !== undefined && currentRun.status === 'completed' && (
              <div className="p-3 border-t border-border1">
                <div className="text-[10px] text-icon3 uppercase mb-1">Final Output</div>
                <pre className="p-2 bg-surface4 rounded overflow-x-auto text-icon4 font-mono text-xs">
                  {JSON.stringify(currentRun.output, null, 2)}
                </pre>
              </div>
            )}

            {/* Error */}
            {currentRun.error && currentRun.status === 'failed' && (
              <div className="p-3 border-t border-border1">
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                  {currentRun.error}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Play className="w-8 h-8 text-icon2 mx-auto mb-2" />
              <p className="text-sm text-icon4">No test run</p>
              <p className="text-xs text-icon3 mt-1">Click "Run Test" to execute the workflow</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
