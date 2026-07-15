import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
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
import { cn } from '@/lib/utils';

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

export function SkillDetail({ skill, rawSkillMd, onReferenceClick }: SkillDetailProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['instructions']));
  const [showRawInstructions, setShowRawInstructions] = useState(false);
  const sourceInfo = getSourceInfo(skill.source);

  // A skill with no description can't be indexed for search — surface that
  // (the only real "invalid" signal in workspace skill data).
  const isInvalid = !skill.description?.trim();
  const installCommand = skill.skillsShSource
    ? `npx skills add ${skill.skillsShSource.owner}/${skill.skillsShSource.repo}/${skill.name}`
    : null;

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
        <div className="rounded-lg border border-border2 bg-surface5 p-3">
          <SkillIcon className="h-6 w-6 text-accent1" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral6">{skill.name}</h1>
            {isInvalid ? (
              <Badge variant="warning">Invalid</Badge>
            ) : skill.skillsShSource ? (
              <Badge variant="info">skills.sh</Badge>
            ) : null}
          </div>
          <p className={cn('mt-1 text-sm', skill.description ? 'text-neutral4' : 'text-neutral3')}>
            {skill.description || 'No description provided.'}
          </p>
          {/* Compact meta row (reference `.d-meta`) — no heavy cards. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral3">
            <span className="inline-flex items-center gap-1.5">
              {sourceInfo.icon}
              {sourceInfo.label}
            </span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-neutral2" />
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-mono">{skill.path}</span>
            </span>
            {skill.references.length > 0 && (
              <>
                <span aria-hidden className="h-1 w-1 rounded-full bg-neutral2" />
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {skill.references.length} {skill.references.length === 1 ? 'reference' : 'references'}
                </span>
              </>
            )}
            {skill.license && (
              <>
                <span aria-hidden className="h-1 w-1 rounded-full bg-neutral2" />
                <span>{String(skill.license)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Install command (skills.sh skills only) */}
      {installCommand && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral3">Install</p>
          <div className="flex items-center gap-2 rounded-lg border border-border1 bg-surface1 px-3 py-2 font-mono text-sm">
            <span className="text-accent1">$</span>
            <code className="min-w-0 flex-1 truncate text-neutral6">{installCommand}</code>
            <CopyButton content={installCommand} copyMessage="Copied install command" variant="ghost" />
          </div>
        </div>
      )}

      {/* Instructions — unboxed so the rendered SKILL.md can breathe. */}
      <div className="border-t border-border1 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral3">Instructions</h2>
          <button
            onClick={() => setShowRawInstructions(!showRawInstructions)}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-neutral4 transition-colors hover:bg-surface4 hover:text-neutral5"
            title={showRawInstructions ? 'Show rendered' : 'Show source'}
          >
            {showRawInstructions ? <Eye className="h-3.5 w-3.5" /> : <FileCode2 className="h-3.5 w-3.5" />}
            {showRawInstructions ? 'Rendered' : 'Source'}
          </button>
        </div>
        {showRawInstructions ? (
          <div className="w-0 min-w-full overflow-x-auto rounded-lg bg-surface1">
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
      </div>

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
                <FileText className="h-4 w-4 text-neutral3" />
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
              <div key={script} className="flex items-center gap-2 px-3 py-2 rounded bg-surface3">
                <Code className="h-4 w-4 text-neutral3" />
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
              <div key={asset} className="flex items-center gap-2 px-3 py-2 rounded bg-surface3">
                <Image className="h-4 w-4 text-neutral3" />
                <span className="text-sm text-neutral5">{asset}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

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
            <ChevronDown className="h-4 w-4 text-neutral3" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral3" />
          )}
          <span className="text-sm font-medium text-neutral5">{title}</span>
        </button>
        {headerAction && <div className="pr-3">{headerAction}</div>}
      </div>
      {isExpanded && <div className="p-4 bg-surface2 overflow-x-auto w-0 min-w-full">{children}</div>}
    </div>
  );
}
