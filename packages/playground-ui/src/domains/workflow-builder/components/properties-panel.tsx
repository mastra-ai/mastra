import { useState, useMemo, type ReactNode } from 'react';
import {
  PlayCircle,
  Bot,
  Wrench,
  GitBranch,
  GitMerge,
  RefreshCw,
  List,
  ArrowRightLeft,
  Hand,
  Workflow,
  Clock,
  Network,
  ChevronDown,
  ChevronRight,
  Database,
  PanelRightClose,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import { TriggerConfig } from './panels/trigger-config';
import { AgentConfig } from './panels/agent-config';
import { ToolConfig } from './panels/tool-config';
import { ConditionConfig } from './panels/condition-config';
import { ParallelConfig } from './panels/parallel-config';
import { LoopConfig } from './panels/loop-config';
import { ForeachConfig } from './panels/foreach-config';
import { TransformConfig } from './panels/transform-config';
import { SuspendConfig } from './panels/suspend-config';
import { WorkflowConfig } from './panels/workflow-config';
import { SleepConfig } from './panels/sleep-config';
import { AgentNetworkConfig } from './panels/agent-network-config';
import { DataPreviewPanel } from './panels/data-preview-panel';
import { ErrorBoundary } from './error-boundary';
import { cn } from '@/lib/utils';
import type { BuilderNodeType, BuilderNode } from '../types';
import { useSelectedNodeDataContext } from '../hooks/use-data-context';
import { getIssuesForNode, hasErrorsForNode, hasWarningsForNode, type ValidationIssue } from '../utils/validate';

/**
 * Error boundary wrapper for config panel components.
 * Provides a compact error UI when a config panel crashes.
 */
function ConfigPanelErrorBoundary({ children, nodeType }: { children: ReactNode; nodeType: string }) {
  return (
    <ErrorBoundary minimal context={`${nodeType} config`} className="m-0">
      {children}
    </ErrorBoundary>
  );
}

/**
 * Collapsible section showing validation issues for the selected node.
 */
function NodeValidationIssues({ issues }: { issues: ValidationIssue[] }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (issues.length === 0) return null;

  return (
    <div className="border-t border-border1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface3 transition-colors"
      >
        {errors.length > 0 ? (
          <AlertCircle className="w-4 h-4 text-red-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
        <span className="text-xs font-medium text-icon5 flex-1 text-left">Issues</span>
        <span className={cn('text-[10px]', errors.length > 0 ? 'text-red-500' : 'text-amber-500')}>
          {errors.length > 0 && `${errors.length} error${errors.length !== 1 ? 's' : ''}`}
          {errors.length > 0 && warnings.length > 0 && ', '}
          {warnings.length > 0 && `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
        </span>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-icon3" /> : <ChevronRight className="w-4 h-4 text-icon3" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {issues.map((issue, index) => (
            <div
              key={index}
              className={cn(
                'p-2 rounded-md text-xs',
                issue.severity === 'error'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-amber-500/10 border border-amber-500/20',
              )}
            >
              <div className="flex items-start gap-2">
                {issue.severity === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium', issue.severity === 'error' ? 'text-red-400' : 'text-amber-400')}>
                    {issue.message}
                  </p>
                  {issue.field && <p className="text-icon3 mt-0.5">Field: {issue.field}</p>}
                  {issue.suggestion && <p className="text-icon4 mt-1">{issue.suggestion}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders the appropriate config component for a node type with error boundary.
 */
function NodeConfigRenderer({ node }: { node: BuilderNode }) {
  const nodeType = node.data.type;

  const configComponent = (() => {
    switch (nodeType) {
      case 'trigger':
        return <TriggerConfig node={node} />;
      case 'agent':
        return <AgentConfig node={node} />;
      case 'tool':
        return <ToolConfig node={node} />;
      case 'condition':
        return <ConditionConfig node={node} />;
      case 'parallel':
        return <ParallelConfig node={node} />;
      case 'loop':
        return <LoopConfig node={node} />;
      case 'foreach':
        return <ForeachConfig node={node} />;
      case 'transform':
        return <TransformConfig node={node} />;
      case 'suspend':
        return <SuspendConfig node={node} />;
      case 'workflow':
        return <WorkflowConfig node={node} />;
      case 'sleep':
        return <SleepConfig node={node} />;
      case 'agent-network':
        return <AgentNetworkConfig node={node} />;
      default:
        return <p className="text-xs text-icon3">Unknown node type: {nodeType}</p>;
    }
  })();

  return <ConfigPanelErrorBoundary nodeType={nodeType}>{configComponent}</ConfigPanelErrorBoundary>;
}

export interface PropertiesPanelProps {
  className?: string;
  onCollapse?: () => void;
}

const NODE_INFO: Record<BuilderNodeType, { label: string; icon: typeof PlayCircle; color: string }> = {
  trigger: { label: 'Trigger', icon: PlayCircle, color: '#22c55e' },
  agent: { label: 'Agent', icon: Bot, color: '#3b82f6' },
  tool: { label: 'Tool', icon: Wrench, color: '#a855f7' },
  condition: { label: 'Condition', icon: GitBranch, color: '#eab308' },
  parallel: { label: 'Parallel', icon: GitMerge, color: '#06b6d4' },
  loop: { label: 'Loop', icon: RefreshCw, color: '#f97316' },
  foreach: { label: 'For Each', icon: List, color: '#ec4899' },
  transform: { label: 'Transform', icon: ArrowRightLeft, color: '#14b8a6' },
  suspend: { label: 'Human Input', icon: Hand, color: '#ef4444' },
  workflow: { label: 'Sub-Workflow', icon: Workflow, color: '#6366f1' },
  sleep: { label: 'Sleep', icon: Clock, color: '#6b7280' },
  'agent-network': { label: 'Agent Network', icon: Network, color: '#8b5cf6' },
};

// Node types that can reference data from upstream steps
const DATA_CONSUMER_TYPES: BuilderNodeType[] = [
  'agent',
  'tool',
  'condition',
  'loop',
  'foreach',
  'transform',
  'workflow',
  'agent-network',
];

export function PropertiesPanel({ className, onCollapse }: PropertiesPanelProps) {
  const selectedNodeId = useWorkflowBuilderStore(state => state.selectedNodeId);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const validationResult = useWorkflowBuilderStore(state => state.validationResult);
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const [showDataPreview, setShowDataPreview] = useState(true);
  const dataContext = useSelectedNodeDataContext();

  // Get validation issues for the selected node
  const nodeIssues = useMemo(() => {
    if (!selectedNode || !validationResult) return [];
    return getIssuesForNode(validationResult, selectedNode.id);
  }, [selectedNode, validationResult]);

  if (!selectedNode) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border1">
          <h2 className="text-sm font-semibold text-icon6">Properties</h2>
          {onCollapse && (
            <button type="button" onClick={onCollapse} className="p-1 hover:bg-surface3 rounded" title="Collapse panel">
              <PanelRightClose className="w-4 h-4 text-icon4" />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-icon3 text-center">Select a node to view and edit its properties</p>
        </div>
      </div>
    );
  }

  const nodeType = selectedNode.data.type;
  const info = NODE_INFO[nodeType];
  const Icon = info.icon;
  const showDataSection = DATA_CONSUMER_TYPES.includes(nodeType) && dataContext.sources.length > 0;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border1">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${info.color}20` }}
          >
            <Icon className="w-4 h-4" style={{ color: info.color }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-icon6">{info.label}</h2>
            <p className="text-xs text-icon3">ID: {selectedNode.id.slice(0, 8)}...</p>
          </div>
        </div>
        {onCollapse && (
          <button type="button" onClick={onCollapse} className="p-1 hover:bg-surface3 rounded" title="Collapse panel">
            <PanelRightClose className="w-4 h-4 text-icon4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Validation Issues Section (shown if node has issues) */}
        <NodeValidationIssues issues={nodeIssues} />

        {/* Node-specific config with error boundary */}
        <div className="p-4">
          <NodeConfigRenderer node={selectedNode} />
        </div>

        {/* Data Preview Section (collapsible) */}
        {showDataSection && (
          <div className="border-t border-border1">
            <button
              type="button"
              onClick={() => setShowDataPreview(!showDataPreview)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface3 transition-colors"
            >
              <Database className="w-4 h-4 text-icon3" />
              <span className="text-xs font-medium text-icon5 flex-1 text-left">Available Data</span>
              <span className="text-[10px] text-icon3">{dataContext.sources.length} sources</span>
              {showDataPreview ? (
                <ChevronDown className="w-4 h-4 text-icon3" />
              ) : (
                <ChevronRight className="w-4 h-4 text-icon3" />
              )}
            </button>

            {showDataPreview && (
              <div className="border-t border-border1">
                <DataPreviewPanel compact className="max-h-[300px]" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
