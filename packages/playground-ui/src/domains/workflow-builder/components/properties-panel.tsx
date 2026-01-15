import { useState } from 'react';
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
import { cn } from '@/lib/utils';
import type { BuilderNodeType } from '../types';
import { useSelectedNodeDataContext } from '../hooks/use-data-context';

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
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const [showDataPreview, setShowDataPreview] = useState(true);
  const dataContext = useSelectedNodeDataContext();

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
        {/* Node-specific config */}
        <div className="p-4">
          {nodeType === 'trigger' && <TriggerConfig node={selectedNode} />}
          {nodeType === 'agent' && <AgentConfig node={selectedNode} />}
          {nodeType === 'tool' && <ToolConfig node={selectedNode} />}
          {nodeType === 'condition' && <ConditionConfig node={selectedNode} />}
          {nodeType === 'parallel' && <ParallelConfig node={selectedNode} />}
          {nodeType === 'loop' && <LoopConfig node={selectedNode} />}
          {nodeType === 'foreach' && <ForeachConfig node={selectedNode} />}
          {nodeType === 'transform' && <TransformConfig node={selectedNode} />}
          {nodeType === 'suspend' && <SuspendConfig node={selectedNode} />}
          {nodeType === 'workflow' && <WorkflowConfig node={selectedNode} />}
          {nodeType === 'sleep' && <SleepConfig node={selectedNode} />}
          {nodeType === 'agent-network' && <AgentNetworkConfig node={selectedNode} />}
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
