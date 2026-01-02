import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { EntryList } from '@/components/ui/elements';
import { useLinkComponent } from '@/lib/framework';
import { Wand2, BookOpen, FolderOpen, FileCode, Package, Home, Server } from 'lucide-react';
import type { SkillMetadata, SkillSource } from '../hooks/use-skills';

export interface SkillsTableProps {
  skills: SkillMetadata[];
  isLoading: boolean;
  isSkillsConfigured?: boolean;
}

const columns = [
  { name: 'name', label: 'Skill', size: '1fr' },
  { name: 'description', label: 'Description', size: '2fr' },
  { name: 'tools', label: 'Allowed Tools', size: '8rem' },
];

function getSourceIcon(source?: SkillSource) {
  if (!source) return <Package className="h-3 w-3" />;

  switch (source.type) {
    case 'external':
      return <Package className="h-3 w-3" />;
    case 'local':
      return <Home className="h-3 w-3" />;
    case 'managed':
      return <Server className="h-3 w-3" />;
    default:
      return <Package className="h-3 w-3" />;
  }
}

function getSourceLabel(source?: SkillSource) {
  if (!source) return 'Unknown';

  switch (source.type) {
    case 'external':
      return 'External';
    case 'local':
      return 'Local';
    case 'managed':
      return 'Managed';
    default:
      return 'Unknown';
  }
}

export function SkillsTable({ skills, isLoading, isSkillsConfigured = true }: SkillsTableProps) {
  const { navigate } = useLinkComponent();

  if (!isSkillsConfigured && !isLoading) {
    return <SkillsNotConfigured />;
  }

  if (isLoading) {
    return <SkillsTableSkeleton />;
  }

  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={columns} />
        {skills.length > 0 ? (
          <EntryList.Entries>
            {skills.map(skill => {
              const entry = {
                id: skill.name,
                name: skill.name,
                description: skill.description || '—',
                tools: skill.allowedTools?.length || 0,
              };

              return (
                <EntryList.Entry
                  key={skill.name}
                  entry={entry}
                  columns={columns}
                  onClick={() => navigate(`/skills/${encodeURIComponent(skill.name)}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-surface5">
                      <Wand2 className="h-3.5 w-3.5 text-icon4" />
                    </div>
                    <span className="font-medium text-icon6">{skill.name}</span>
                  </div>
                  <EntryList.EntryText>{skill.description || '—'}</EntryList.EntryText>
                  <div className="flex items-center gap-1.5">
                    {skill.allowedTools && skill.allowedTools.length > 0 ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6875rem] bg-green-500/10 text-green-400">
                        <FileCode className="h-3 w-3" />
                        {skill.allowedTools.length}
                      </span>
                    ) : (
                      <span className="text-icon3 text-xs">None</span>
                    )}
                  </div>
                </EntryList.Entry>
              );
            })}
          </EntryList.Entries>
        ) : (
          <EntryList.Message message="No skills discovered. Add SKILL.md files to your skills directory." />
        )}
      </EntryList.Trim>
    </EntryList>
  );
}

function SkillsTableSkeleton() {
  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={columns} />
        <EntryList.Entries>
          {Array.from({ length: 3 }).map((_, i) => (
            <EntryList.Entry key={i} columns={columns} isLoading>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded bg-surface4 animate-pulse" />
                <div className="h-4 w-32 rounded bg-surface4 animate-pulse" />
              </div>
              <div className="h-4 w-48 rounded bg-surface4 animate-pulse" />
              <div className="h-5 w-10 rounded bg-surface4 animate-pulse" />
            </EntryList.Entry>
          ))}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
  );
}

function SkillsNotConfigured() {
  return (
    <div className="grid place-items-center py-16">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="p-4 rounded-full bg-surface4 mb-4">
          <Wand2 className="h-8 w-8 text-icon3" />
        </div>
        <h2 className="text-lg font-medium text-icon6 mb-2">Skills Not Configured</h2>
        <p className="text-sm text-icon4 mb-6">
          No Skills instance is registered with Mastra. Add a Skills instance to your configuration to discover and
          manage agent skills.
        </p>
        <Button size="lg" variant="default" as="a" href="https://mastra.ai/en/docs/skills/overview" target="_blank">
          <Icon>
            <BookOpen className="h-4 w-4" />
          </Icon>
          Learn about Skills
        </Button>
      </div>
    </div>
  );
}

export { SkillsNotConfigured };
