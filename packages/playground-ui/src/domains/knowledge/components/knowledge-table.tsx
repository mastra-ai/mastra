import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { EntryList } from '@/components/ui/elements';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { useLinkComponent } from '@/lib/framework';
import { Database, Search, Sparkles, BookOpen, FolderOpen, Trash2 } from 'lucide-react';
import type { KnowledgeNamespace } from '../hooks/use-knowledge';

export interface KnowledgeTableProps {
  namespaces: KnowledgeNamespace[];
  isLoading: boolean;
  isKnowledgeConfigured?: boolean;
  onDelete?: (namespace: string) => void;
}

const columns = [
  { name: 'namespace', label: 'Namespace', size: '1fr' },
  { name: 'description', label: 'Description', size: '1.5fr' },
  { name: 'artifacts', label: 'Artifacts', size: '6rem' },
  { name: 'search', label: 'Search', size: '10rem' },
  { name: 'actions', label: '', size: '3rem' },
];

export function KnowledgeTable({ namespaces, isLoading, isKnowledgeConfigured = true, onDelete }: KnowledgeTableProps) {
  const { navigate } = useLinkComponent();
  const [deleteNamespace, setDeleteNamespace] = useState<string | null>(null);

  if (!isKnowledgeConfigured && !isLoading) {
    return <KnowledgeNotConfigured />;
  }

  if (isLoading) {
    return <KnowledgeTableSkeleton />;
  }

  return (
    <>
      <EntryList>
        <EntryList.Trim>
          <EntryList.Header columns={columns} />
          {namespaces.length > 0 ? (
            <EntryList.Entries>
              {namespaces.map(ns => {
                const entry = {
                  id: ns.namespace,
                  namespace: ns.namespace,
                  description: ns.description || '—',
                  artifacts: ns.artifactCount,
                  search: { hasBM25: ns.hasBM25, hasVector: ns.hasVector },
                };

                return (
                  <EntryList.Entry
                    key={ns.namespace}
                    entry={entry}
                    columns={columns}
                    onClick={() => navigate(`/knowledge/${encodeURIComponent(ns.namespace)}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-surface5">
                        <Database className="h-3.5 w-3.5 text-icon4" />
                      </div>
                      <span className="font-medium text-icon6">{ns.namespace}</span>
                    </div>
                    <EntryList.EntryText>{ns.description || '—'}</EntryList.EntryText>
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 text-icon3" />
                      <span className="tabular-nums">{ns.artifactCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {ns.hasBM25 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6875rem] bg-blue-500/10 text-blue-400">
                          <Search className="h-3 w-3" />
                          BM25
                        </span>
                      )}
                      {ns.hasVector && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.6875rem] bg-purple-500/10 text-purple-400">
                          <Sparkles className="h-3 w-3" />
                          Vector
                        </span>
                      )}
                      {!ns.hasBM25 && !ns.hasVector && <span className="text-icon3 text-xs">None</span>}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteNamespace(ns.namespace);
                        }}
                        className="p-1.5 rounded hover:bg-surface5 text-icon3 hover:text-red-400 transition-colors"
                        title="Delete namespace"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </EntryList.Entry>
                );
              })}
            </EntryList.Entries>
          ) : (
            <EntryList.Message message="No knowledge namespaces yet. Create one to get started." />
          )}
        </EntryList.Trim>
      </EntryList>

      <AlertDialog open={!!deleteNamespace} onOpenChange={() => setDeleteNamespace(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Namespace</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete "{deleteNamespace}"? This will permanently delete all artifacts in this
              namespace. This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={() => {
                if (deleteNamespace && onDelete) {
                  onDelete(deleteNamespace);
                }
                setDeleteNamespace(null);
              }}
            >
              Delete
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}

function KnowledgeTableSkeleton() {
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
              <div className="h-4 w-8 rounded bg-surface4 animate-pulse" />
              <div className="flex gap-1.5">
                <div className="h-5 w-14 rounded bg-surface4 animate-pulse" />
                <div className="h-5 w-16 rounded bg-surface4 animate-pulse" />
              </div>
              <div />
            </EntryList.Entry>
          ))}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
  );
}

function KnowledgeNotConfigured() {
  return (
    <div className="grid place-items-center py-16">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="p-4 rounded-full bg-surface4 mb-4">
          <Database className="h-8 w-8 text-icon3" />
        </div>
        <h2 className="text-lg font-medium text-icon6 mb-2">Knowledge Not Configured</h2>
        <p className="text-sm text-icon4 mb-6">
          No Knowledge instance is registered with Mastra. Add a Knowledge instance to your configuration to store and
          search documents.
        </p>
        <Button size="lg" variant="default" as="a" href="https://mastra.ai/en/docs/rag/overview" target="_blank">
          <Icon>
            <BookOpen className="h-4 w-4" />
          </Icon>
          Learn about Knowledge
        </Button>
      </div>
    </div>
  );
}

export { KnowledgeNotConfigured };
