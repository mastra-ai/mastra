import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { SkillIcon } from '@mastra/playground-ui/icons/SkillIcon';
import {
  FileText,
  Code,
  Image,
  Package,
  Home,
  Server,
  ChevronRight,
  ChevronDown,
  Eye,
  FileCode2,
  FolderOpen,
} from 'lucide-react';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { Skill, SkillSource } from '../types';

export interface SkillDetailProps {
  skill: Skill;
  /** Raw SKILL.md file contents to show in "Source" view. Falls back to skill.instructions if not provided. */
  rawSkillMd?: string;
  onReferenceClick?: (referencePath: string) => void;
}

function getSourceInfo(source: SkillSource): { icon: React.ReactNode; label: string; path: string } {
  switch (source.type) {
    case 'external':
      return {
        icon: <Package className="size-3.5" />,
        label: 'External Package',
        path: source.packagePath,
      };
    case 'local':
      return {
        icon: <Home className="size-3.5" />,
        label: 'Local Project',
        path: source.projectPath,
      };
    case 'managed':
      return {
        icon: <Server className="size-3.5" />,
        label: 'Managed',
        path: source.mastraPath,
      };
  }
}

export function SkillDetail({ skill, rawSkillMd, onReferenceClick }: SkillDetailProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['instructions']));
  const [showRawInstructions, setShowRawInstructions] = useState(false);
  const sourceInfo = getSourceInfo(skill.source);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="min-w-0 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-surface5 p-3">
          <SkillIcon className="size-6 text-neutral4" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-neutral6">{skill.name}</h1>
          <p className="mt-1 text-sm text-neutral4">{skill.description}</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetadataCard label="Source" value={sourceInfo.label} icon={sourceInfo.icon} />
        <MetadataCard label="Path" value={skill.path} icon={<FolderOpen className="size-3.5" />} />
        {skill.license && <MetadataCard label="License" value={skill.license} />}
        {skill.compatibility != null && <MetadataCard label="Compatibility" value={skill.compatibility} />}
        <MetadataCard
          label="References"
          value={`${skill.references.length} files`}
          icon={<FileText className="size-3.5" />}
        />
      </div>

      {/* Instructions */}
      <CollapsibleSection
        title="Instructions"
        isExpanded={expandedSections.has('instructions')}
        onToggle={() => toggleSection('instructions')}
        headerAction={
          <button
            onClick={e => {
              e.stopPropagation();
              setShowRawInstructions(!showRawInstructions);
            }}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-neutral4 transition-colors hover:bg-surface4 hover:text-neutral5"
            title={showRawInstructions ? 'Show rendered' : 'Show source'}
          >
            {showRawInstructions ? <Eye className="size-3.5" /> : <FileCode2 className="size-3.5" />}
            {showRawInstructions ? 'Rendered' : 'Source'}
          </button>
        }
      >
        {showRawInstructions ? (
          <div style={{ backgroundColor: 'black' }} className="w-0 min-w-full overflow-x-auto rounded-lg">
            <SyntaxHighlighter
              language="markdown"
              style={coldarkDark}
              customStyle={{
                margin: 0,
                padding: '1rem',
                backgroundColor: 'transparent',
                fontSize: '0.875rem',
              }}
            >
              {rawSkillMd ?? skill.instructions}
            </SyntaxHighlighter>
          </div>
        ) : (
          <MarkdownRenderer>{skill.instructions}</MarkdownRenderer>
        )}
      </CollapsibleSection>

      {/* References */}
      {skill.references.length > 0 && (
        <CollapsibleSection
          title={`References (${skill.references.length})`}
          isExpanded={expandedSections.has('references')}
          onToggle={() => toggleSection('references')}
        >
          <div className="space-y-1">
            {skill.references.map(ref => (
              <button
                key={ref}
                onClick={() => onReferenceClick?.(ref)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left transition-colors hover:bg-surface4"
              >
                <FileText className="size-4 text-neutral3" />
                <span className="text-sm text-neutral5">{ref}</span>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Scripts */}
      {skill.scripts.length > 0 && (
        <CollapsibleSection
          title={`Scripts (${skill.scripts.length})`}
          isExpanded={expandedSections.has('scripts')}
          onToggle={() => toggleSection('scripts')}
        >
          <div className="space-y-1">
            {skill.scripts.map(script => (
              <div key={script} className="flex items-center gap-2 rounded bg-surface3 px-3 py-2">
                <Code className="size-4 text-neutral3" />
                <span className="text-sm text-neutral5">{script}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Assets */}
      {skill.assets.length > 0 && (
        <CollapsibleSection
          title={`Assets (${skill.assets.length})`}
          isExpanded={expandedSections.has('assets')}
          onToggle={() => toggleSection('assets')}
        >
          <div className="space-y-1">
            {skill.assets.map(asset => (
              <div key={asset} className="flex items-center gap-2 rounded bg-surface3 px-3 py-2">
                <Image className="size-4 text-neutral3" />
                <span className="text-sm text-neutral5">{asset}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Path */}
      <div className="border-t border-border1 pt-4">
        <p className="text-xs text-neutral3">
          Path: <code className="rounded bg-surface4 px-1 py-0.5">{skill.path}</code>
        </p>
      </div>
    </div>
  );
}

/**
 * Format a value for display, handling strings, objects, and arrays.
 */
function formatDisplayValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(v => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    // For objects, show a compact summary
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (keys.length === 1) {
      const key = keys[0];
      const val = (value as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        return `${key}: ${val.join(', ')}`;
      }
      return `${key}: ${formatDisplayValue(val)}`;
    }
    return `{${keys.join(', ')}}`;
  }
  return String(value);
}

function MetadataCard({ label, value, icon }: { label: string; value: unknown; icon?: React.ReactNode }) {
  const displayValue = formatDisplayValue(value);
  return (
    <div className="rounded-lg bg-surface3 p-3">
      <p className="mb-1 text-xs text-neutral3">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-neutral4">{icon}</span>}
        <p className="truncate text-sm font-medium text-neutral5" title={displayValue}>
          {displayValue}
        </p>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  headerAction,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border1">
      <div className="flex items-center bg-surface3 transition-colors hover:bg-surface4">
        <button onClick={onToggle} className="flex flex-1 items-center gap-2 px-4 py-3">
          {isExpanded ? (
            <ChevronDown className="size-4 text-neutral3" />
          ) : (
            <ChevronRight className="size-4 text-neutral3" />
          )}
          <span className="text-sm font-medium text-neutral5">{title}</span>
        </button>
        {headerAction && <div className="pr-3">{headerAction}</div>}
      </div>
      {isExpanded && <div className="w-0 min-w-full overflow-x-auto bg-surface2 p-4">{children}</div>}
    </div>
  );
}
