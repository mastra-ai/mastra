import { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowValidation, type ValidationIssue, type ValidationSeverity } from '../hooks/use-workflow-validation';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';

// ============================================================================
// Props
// ============================================================================

export interface ValidationPanelProps {
  toolInputSchemas?: Map<string, { required: string[]; all: string[] }>;
  onClose?: () => void;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function SeverityIcon({ severity, className }: { severity: ValidationSeverity; className?: string }) {
  switch (severity) {
    case 'error':
      return <AlertCircle className={cn('text-red-500', className)} />;
    case 'warning':
      return <AlertTriangle className={cn('text-amber-500', className)} />;
    case 'info':
      return <Info className={cn('text-blue-400', className)} />;
  }
}

function IssueRow({ issue, onClick }: { issue: ValidationIssue; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors',
        'hover:bg-surface3',
        issue.severity === 'error' && 'border-red-500/30 bg-red-500/5',
        issue.severity === 'warning' && 'border-amber-500/30 bg-amber-500/5',
        issue.severity === 'info' && 'border-blue-500/30 bg-blue-500/5',
      )}
    >
      <div className="flex items-start gap-2">
        <SeverityIcon severity={issue.severity} className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-icon6">{issue.message}</p>
          {issue.nodeLabel && (
            <p className="text-[10px] text-icon3 mt-1">
              Node: {issue.nodeLabel}
              {issue.field && <span className="ml-2">Field: {issue.field}</span>}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function IssueSection({
  title,
  issues,
  severity,
  defaultExpanded = true,
  onIssueClick,
}: {
  title: string;
  issues: ValidationIssue[];
  severity: ValidationSeverity;
  defaultExpanded?: boolean;
  onIssueClick?: (issue: ValidationIssue) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (issues.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4 text-icon3" /> : <ChevronRight className="w-4 h-4 text-icon3" />}
        <SeverityIcon severity={severity} className="w-4 h-4" />
        <span className="text-xs font-medium text-icon5">{title}</span>
        <span className="text-xs text-icon3">({issues.length})</span>
      </button>

      {isExpanded && (
        <div className="ml-6 space-y-2">
          {issues.map(issue => (
            <IssueRow key={issue.id} issue={issue} onClick={() => onIssueClick?.(issue)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ValidationPanel({ toolInputSchemas, onClose, className }: ValidationPanelProps) {
  const validation = useWorkflowValidation(toolInputSchemas);
  const selectNode = useWorkflowBuilderStore(state => state.selectNode);

  const handleIssueClick = (issue: ValidationIssue) => {
    if (issue.nodeId) {
      selectNode(issue.nodeId);
    }
  };

  return (
    <div className={cn('bg-surface1 border border-border1 rounded-lg shadow-lg', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border1">
        <div className="flex items-center gap-2">
          {validation.isValid ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-green-500">Workflow is valid</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-500">
                {validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''} found
              </span>
            </>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 hover:bg-surface3 rounded">
            <X className="w-4 h-4 text-icon3" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-4 max-h-[400px] overflow-y-auto">
        {validation.all.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-icon5">No issues found</p>
            <p className="text-xs text-icon3 mt-1">Your workflow is ready to save and run</p>
          </div>
        ) : (
          <>
            <IssueSection
              title="Errors"
              issues={validation.errors}
              severity="error"
              defaultExpanded={true}
              onIssueClick={handleIssueClick}
            />
            <IssueSection
              title="Warnings"
              issues={validation.warnings}
              severity="warning"
              defaultExpanded={validation.errors.length === 0}
              onIssueClick={handleIssueClick}
            />
            <IssueSection
              title="Info"
              issues={validation.infos}
              severity="info"
              defaultExpanded={false}
              onIssueClick={handleIssueClick}
            />
          </>
        )}
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-t border-border1 bg-surface2">
        <div className="flex items-center justify-between text-[10px] text-icon3">
          <span>
            {validation.errors.length} errors, {validation.warnings.length} warnings
          </span>
          {!validation.isValid && <span className="text-red-400">Fix errors before saving</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Compact Validation Badge (for toolbar)
// ============================================================================

export interface ValidationBadgeProps {
  toolInputSchemas?: Map<string, { required: string[]; all: string[] }>;
  onClick?: () => void;
}

export function ValidationBadge({ toolInputSchemas, onClick }: ValidationBadgeProps) {
  const validation = useWorkflowValidation(toolInputSchemas);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
        validation.isValid
          ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
          : 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
      )}
    >
      {validation.isValid ? (
        <>
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Valid</span>
        </>
      ) : (
        <>
          <AlertCircle className="w-3.5 h-3.5" />
          <span>
            {validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''}
          </span>
        </>
      )}
      {validation.warnings.length > 0 && <span className="text-amber-500">+{validation.warnings.length}</span>}
    </button>
  );
}
