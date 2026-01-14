import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, ArrowRight, Database, Braces } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Data Reference Picker
// ============================================================================

export interface DataReference {
  /** The reference path (e.g., "steps.agent_1.output.text") */
  path: string;
  /** Display label */
  label: string;
  /** Description of the data */
  description?: string;
  /** Type of data source */
  sourceType?: 'input' | 'state' | 'step';
  /** Icon to show */
  icon?: React.ReactNode;
}

export interface DataReferencePickerProps {
  /** Available data references to choose from */
  references: DataReference[];
  /** Currently selected reference path */
  value?: string;
  /** Called when selection changes */
  onChange: (path: string | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A styled dropdown for selecting data references from upstream steps.
 * Shows the data path with visual hierarchy and icons.
 */
export function DataReferencePicker({
  references,
  value,
  onChange,
  placeholder = 'Select data source...',
  className,
}: DataReferencePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedRef = references.find(r => r.path === value);

  const handleSelect = useCallback(
    (path: string) => {
      onChange(path);
      setIsOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange],
  );

  // Group references by source type
  const groupedRefs = references.reduce(
    (acc, ref) => {
      const type = ref.sourceType || 'step';
      if (!acc[type]) acc[type] = [];
      acc[type].push(ref);
      return acc;
    },
    {} as Record<string, DataReference[]>,
  );

  const groupLabels: Record<string, string> = {
    input: 'Workflow Input',
    state: 'Workflow State',
    step: 'Step Outputs',
  };

  const groupOrder = ['input', 'state', 'step'];

  return (
    <div className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-surface3 border border-border1',
          'hover:border-border2 focus:outline-none focus:ring-2 focus:ring-accent1/50',
          'transition-all duration-150',
          isOpen && 'border-accent1 ring-2 ring-accent1/50',
        )}
      >
        {selectedRef ? (
          <>
            <Database className="w-4 h-4 text-accent1 flex-shrink-0" />
            <div className="flex-1 text-left overflow-hidden">
              <div className="text-xs font-mono text-icon6 truncate">{selectedRef.path}</div>
              {selectedRef.description && (
                <div className="text-[10px] text-icon3 truncate">{selectedRef.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-surface4 rounded transition-colors"
              aria-label="Clear selection"
            >
              <span className="text-icon3 text-xs">×</span>
            </button>
          </>
        ) : (
          <>
            <Database className="w-4 h-4 text-icon3 flex-shrink-0" />
            <span className="flex-1 text-left text-xs text-icon3">{placeholder}</span>
          </>
        )}
        <ChevronDown className={cn('w-4 h-4 text-icon3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Menu */}
          <div
            className={cn(
              'absolute top-full left-0 right-0 mt-1 z-50',
              'bg-surface2 border border-border1 rounded-lg shadow-xl',
              'max-h-64 overflow-y-auto',
            )}
          >
            {references.length === 0 ? (
              <div className="p-4 text-center text-xs text-icon3">No data sources available</div>
            ) : (
              <div className="py-1">
                {groupOrder.map(groupKey => {
                  const groupRefs = groupedRefs[groupKey];
                  if (!groupRefs || groupRefs.length === 0) return null;

                  return (
                    <div key={groupKey}>
                      <div className="px-3 py-1.5 text-[10px] font-medium text-icon3 uppercase tracking-wide bg-surface3/50">
                        {groupLabels[groupKey]}
                      </div>
                      {groupRefs.map(ref => (
                        <button
                          key={ref.path}
                          type="button"
                          onClick={() => handleSelect(ref.path)}
                          className={cn(
                            'w-full flex items-start gap-2 px-3 py-2 text-left',
                            'hover:bg-surface3 transition-colors',
                            value === ref.path && 'bg-accent1/10',
                          )}
                        >
                          <Braces className="w-3.5 h-3.5 text-icon4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-icon6 truncate">{ref.path}</div>
                            {ref.description && (
                              <div className="text-[10px] text-icon3 truncate">{ref.description}</div>
                            )}
                          </div>
                          {value === ref.path && <Check className="w-4 h-4 text-accent1 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Output Reference Display
// ============================================================================

export interface OutputReferenceProps {
  /** The step ID */
  stepId: string;
  /** Output paths available from this step */
  paths: Array<{ path: string; description?: string }>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays the output references for a step with copy functionality.
 */
export function OutputReference({ stepId, paths, className }: OutputReferenceProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const handleCopy = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-[10px] text-icon3 flex items-center gap-1.5">
        <ArrowRight className="w-3 h-3" />
        <span>Output available at:</span>
      </div>

      <div className="space-y-1">
        {paths.map(({ path, description }) => {
          const fullPath = `steps.${stepId}.${path}`;
          const isCopied = copiedPath === fullPath;

          return (
            <div
              key={path}
              className={cn(
                'group flex items-center gap-2 px-2.5 py-1.5 rounded-md',
                'bg-surface4/50 border border-transparent',
                'hover:border-border1 transition-all duration-150',
              )}
            >
              <Braces className="w-3.5 h-3.5 text-icon4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <code className="text-[11px] font-mono text-icon6 block truncate">{fullPath}</code>
                {description && <span className="text-[10px] text-icon3">{description}</span>}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(fullPath)}
                className={cn(
                  'p-1 rounded transition-all duration-150',
                  'opacity-0 group-hover:opacity-100',
                  isCopied ? 'text-green-400' : 'text-icon3 hover:text-icon5 hover:bg-surface3',
                )}
                aria-label={isCopied ? 'Copied!' : 'Copy reference'}
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Input/Output Section Headers
// ============================================================================

export interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Whether expanded */
  expanded: boolean;
  /** Toggle callback */
  onToggle: () => void;
  /** Optional badge/count */
  badge?: string | number;
  /** Additional CSS classes */
  className?: string;
}

export function SectionHeader({ title, icon, expanded, onToggle, badge, className }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg',
        'bg-surface3/50 hover:bg-surface3',
        'border border-transparent hover:border-border1',
        'transition-all duration-150',
        expanded && 'bg-surface3 border-border1',
        className,
      )}
    >
      {expanded ? <ChevronDown className="w-4 h-4 text-icon4" /> : <ChevronRight className="w-4 h-4 text-icon4" />}
      {icon && <span className="text-icon4">{icon}</span>}
      <span className="flex-1 text-left text-xs font-medium text-icon5">{title}</span>
      {badge !== undefined && <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface4 text-icon4">{badge}</span>}
    </button>
  );
}
