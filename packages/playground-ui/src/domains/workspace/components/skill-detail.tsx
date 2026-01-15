import { useState } from 'react';
import { Wand2, FileText, Code, Image, Package, Home, Server, ChevronRight, ChevronDown } from 'lucide-react';
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
    <div className="space-y-6">
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
      >
        <div className="prose prose-sm prose-invert max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-icon5 bg-surface3 p-4 rounded-lg overflow-auto">
            {skill.instructions}
          </pre>
        </div>
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
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border1 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-3 bg-surface3 hover:bg-surface4 transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4 text-icon3" /> : <ChevronRight className="h-4 w-4 text-icon3" />}
        <span className="text-sm font-medium text-icon5">{title}</span>
      </button>
      {isExpanded && <div className="p-4 bg-surface2">{children}</div>}
    </div>
  );
}
