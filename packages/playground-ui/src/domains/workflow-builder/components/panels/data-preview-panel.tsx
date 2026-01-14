import { useState } from 'react';
import { ChevronRight, ChevronDown, Database, Copy, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useSelectedNodeDataContext, type DataSource, type DataField } from '../../hooks/use-data-context';

// ============================================================================
// Props
// ============================================================================

export interface DataPreviewPanelProps {
  className?: string;
  /** Callback when a path is selected (for drag-drop or click-to-insert) */
  onPathSelect?: (path: string) => void;
  /** Whether to show a compact version */
  compact?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function TypeBadge({ type }: { type: DataField['type'] }) {
  const colors: Record<DataField['type'], string> = {
    string: 'bg-green-500/20 text-green-400',
    number: 'bg-blue-500/20 text-blue-400',
    boolean: 'bg-amber-500/20 text-amber-400',
    object: 'bg-purple-500/20 text-purple-400',
    array: 'bg-pink-500/20 text-pink-400',
    unknown: 'bg-gray-500/20 text-gray-400',
  };

  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono', colors[type])}>{type}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 hover:bg-surface4 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy path"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-icon3" />}
    </button>
  );
}

function FieldRow({
  field,
  refPrefix,
  depth = 0,
  onSelect,
  searchTerm,
}: {
  field: DataField;
  refPrefix: string;
  depth?: number;
  onSelect?: (path: string) => void;
  searchTerm?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 1);
  const hasNested = field.nested && field.nested.length > 0;
  const fullPath = `${refPrefix}.${field.path}`;

  // Filter nested fields if searching
  const filteredNested = field.nested?.filter(
    f =>
      !searchTerm ||
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.path.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Hide if searching and no match (and no matching children)
  if (
    searchTerm &&
    !field.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !field.path.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!filteredNested || filteredNested.length === 0)
  ) {
    return null;
  }

  const handleClick = () => {
    if (hasNested) {
      setIsExpanded(!isExpanded);
    } else if (onSelect) {
      onSelect(fullPath);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer',
          'hover:bg-surface4 transition-colors',
          onSelect && !hasNested && 'cursor-pointer',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        draggable={!hasNested}
        onDragStart={e => {
          e.dataTransfer.setData('application/workflow-data-path', fullPath);
          e.dataTransfer.effectAllowed = 'copy';
        }}
      >
        {/* Expand/collapse icon */}
        {hasNested ? (
          <button type="button" className="w-4 h-4 flex items-center justify-center text-icon3">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Field name */}
        <span className="text-xs text-icon5 font-medium flex-1 truncate">
          {field.name}
          {field.required && <span className="text-red-400 ml-0.5">*</span>}
        </span>

        {/* Type badge */}
        <TypeBadge type={field.type} />

        {/* Copy button */}
        <CopyButton text={fullPath} />
      </div>

      {/* Nested fields */}
      {hasNested && isExpanded && filteredNested && (
        <div>
          {filteredNested.map(nested => (
            <FieldRow
              key={nested.path}
              field={nested}
              refPrefix={refPrefix}
              depth={depth + 1}
              onSelect={onSelect}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DataSourceSection({
  source,
  onSelect,
  defaultExpanded = true,
  searchTerm,
}: {
  source: DataSource;
  onSelect?: (path: string) => void;
  defaultExpanded?: boolean;
  searchTerm?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Filter fields if searching
  const filteredFields = source.fields.filter(
    f =>
      !searchTerm ||
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Hide section if no matching fields
  if (searchTerm && filteredFields.length === 0) {
    return null;
  }

  return (
    <div className="border border-border1 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn('w-full flex items-center gap-2 px-3 py-2', 'hover:bg-surface3 transition-colors')}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: source.color }} />
        <span className="text-xs font-medium text-icon5 flex-1 text-left truncate">{source.label}</span>
        <span className="text-[10px] text-icon3 font-mono">{source.refPrefix}</span>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-icon3" /> : <ChevronRight className="w-4 h-4 text-icon3" />}
      </button>

      {/* Fields */}
      {isExpanded && (
        <div className="border-t border-border1 bg-surface2 py-1">
          {filteredFields.length > 0 ? (
            filteredFields.map(field => (
              <FieldRow
                key={field.path}
                field={field}
                refPrefix={source.refPrefix}
                onSelect={onSelect}
                searchTerm={searchTerm}
              />
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-icon3 text-center">No fields available</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DataPreviewPanel({ className, onPathSelect, compact = false }: DataPreviewPanelProps) {
  const dataContext = useSelectedNodeDataContext();
  const [searchTerm, setSearchTerm] = useState('');

  if (dataContext.sources.length === 0) {
    return (
      <div className={cn('flex flex-col', className)}>
        {!compact && (
          <div className="p-3 border-b border-border1">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-icon3" />
              <h3 className="text-sm font-medium text-icon5">Available Data</h3>
            </div>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Database className="w-8 h-8 text-icon2 mx-auto mb-2" />
            <p className="text-sm text-icon4">No data sources available</p>
            <p className="text-xs text-icon3 mt-1">Connect this node to other steps to access their outputs</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      {!compact && (
        <div className="p-3 border-b border-border1">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-icon3" />
            <h3 className="text-sm font-medium text-icon5">Available Data</h3>
            <span className="text-xs text-icon3">
              ({dataContext.sources.length} source{dataContext.sources.length !== 1 ? 's' : ''})
            </span>
          </div>
          <p className="text-xs text-icon3">Drag fields to inputs or click to copy path</p>
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-border1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-icon3" />
          <Input
            placeholder="Search fields..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Sources */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {dataContext.sources.map((source, index) => (
          <DataSourceSection
            key={source.id}
            source={source}
            onSelect={onPathSelect}
            defaultExpanded={index === 0}
            searchTerm={searchTerm}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-border1 bg-surface2">
        <p className="text-[10px] text-icon3 text-center">
          Tip: Use <code className="bg-surface4 px-1 rounded">{'{{path}}'}</code> syntax in text fields
        </p>
      </div>
    </div>
  );
}
