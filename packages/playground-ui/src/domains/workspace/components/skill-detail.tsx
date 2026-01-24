import { useState } from 'react';
import { Wand2, FileText, Code, Image, Package, Home, Server, ChevronRight, ChevronDown, Eye, FileCode2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import type { Skill, SkillSource } from '../hooks/use-workspace-skills';

export interface SkillDetailProps {
  skill: Skill;
  onReferenceClick?: (referencePath: string) => void;
}

function getSourceInfo(source: SkillSource): { icon: React.ReactNode; label: string; path: string } {
  switch (source.type) {
    case 'external':
      return {
        icon: <Package className="h-3.5 w-3.5" />,
        label: 'External Package',
        path: source.packagePath,
      };
    case 'local':
      return {
        icon: <Home className="h-3.5 w-3.5" />,
        label: 'Local Project',
        path: source.projectPath,
      };
    case 'managed':
      return {
        icon: <Server className="h-3.5 w-3.5" />,
        label: 'Managed',
        path: source.mastraPath,
      };
  }
}

export function SkillDetail({ skill, onReferenceClick }: SkillDetailProps) {
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
    <div className="space-y-6 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-surface5">
          <Wand2 className="h-6 w-6 text-icon4" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-icon6">{skill.name}</h1>
          <p className="text-sm text-icon4 mt-1">{skill.description}</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetadataCard label="Source" value={sourceInfo.label} icon={sourceInfo.icon} />
        {skill.license && <MetadataCard label="License" value={skill.license} />}
        {skill.compatibility && <MetadataCard label="Compatibility" value={skill.compatibility} />}
        <MetadataCard
          label="References"
          value={`${skill.references.length} files`}
          icon={<FileText className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Allowed Tools */}
      {skill.allowedTools && skill.allowedTools.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-icon5">Allowed Tools</h3>
          <div className="flex flex-wrap gap-2">
            {skill.allowedTools.map(tool => (
              <span
                key={tool}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-green-500/10 text-green-400"
              >
                <Code className="h-3 w-3" />
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

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
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-icon4 hover:text-icon5 hover:bg-surface4 transition-colors"
            title={showRawInstructions ? 'Show rendered' : 'Show source'}
          >
            {showRawInstructions ? <Eye className="h-3.5 w-3.5" /> : <FileCode2 className="h-3.5 w-3.5" />}
            {showRawInstructions ? 'Rendered' : 'Source'}
          </button>
        }
      >
        {showRawInstructions ? (
          <div style={{ backgroundColor: 'black' }} className="rounded-lg overflow-x-auto w-0 min-w-full">
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
              {skill.instructions}
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
                className="flex items-center gap-2 w-full px-3 py-2 rounded hover:bg-surface4 text-left transition-colors"
              >
                <FileText className="h-4 w-4 text-icon3" />
                <span className="text-sm text-icon5">{ref}</span>
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
              <div key={script} className="flex items-center gap-2 px-3 py-2 rounded bg-surface3">
                <Code className="h-4 w-4 text-icon3" />
                <span className="text-sm text-icon5">{script}</span>
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
              <div key={asset} className="flex items-center gap-2 px-3 py-2 rounded bg-surface3">
                <Image className="h-4 w-4 text-icon3" />
                <span className="text-sm text-icon5">{asset}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Path */}
      <div className="pt-4 border-t border-border1">
        <p className="text-xs text-icon3">
          Path: <code className="px-1 py-0.5 rounded bg-surface4">{skill.path}</code>
        </p>
      </div>
    </div>
  );
}

function MetadataCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-surface3">
      <p className="text-xs text-icon3 mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-icon4">{icon}</span>}
        <p className="text-sm font-medium text-icon5">{value}</p>
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
    <div className="border border-border1 rounded-lg overflow-hidden min-w-0">
      <div className="flex items-center bg-surface3 hover:bg-surface4 transition-colors">
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 px-4 py-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-icon3" />
          ) : (
            <ChevronRight className="h-4 w-4 text-icon3" />
          )}
          <span className="text-sm font-medium text-icon5">{title}</span>
        </button>
        {headerAction && <div className="pr-3">{headerAction}</div>}
      </div>
      {isExpanded && <div className="p-4 bg-surface2 overflow-x-auto w-0 min-w-full">{children}</div>}
    </div>
  );
}
