import { useState } from 'react';
import { EntryList } from '@/components/ui/elements';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { FileText, File, Image, Lock, Trash2 } from 'lucide-react';
import type { KnowledgeArtifact } from '../hooks/use-knowledge';

export interface ArtifactTableProps {
  artifacts: KnowledgeArtifact[];
  isLoading: boolean;
  onDelete?: (artifactKey: string) => void;
  onView?: (artifactKey: string) => void;
}

const columns = [
  { name: 'key', label: 'Key', size: '1fr' },
  { name: 'type', label: 'Type', size: '5rem' },
  { name: 'size', label: 'Size', size: '6rem' },
  { name: 'actions', label: '', size: '3rem' },
];

const getArtifactIcon = (type: KnowledgeArtifact['type']) => {
  switch (type) {
    case 'image':
      return <Image className="h-3.5 w-3.5" />;
    case 'file':
      return <File className="h-3.5 w-3.5" />;
    default:
      return <FileText className="h-3.5 w-3.5" />;
  }
};

const getTypeStyle = (type: KnowledgeArtifact['type']) => {
  switch (type) {
    case 'image':
      return 'bg-purple-500/10 text-purple-400';
    case 'file':
      return 'bg-blue-500/10 text-blue-400';
    default:
      return 'bg-green-500/10 text-green-400';
  }
};

const formatBytes = (bytes?: number): string => {
  if (bytes === undefined || bytes === null) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export function ArtifactTable({ artifacts, isLoading, onDelete, onView }: ArtifactTableProps) {
  const [deleteArtifact, setDeleteArtifact] = useState<string | null>(null);

  if (isLoading) {
    return <ArtifactTableSkeleton />;
  }

  return (
    <>
      <EntryList>
        <EntryList.Trim>
          <EntryList.Header columns={columns} />
          {artifacts.length > 0 ? (
            <EntryList.Entries>
              {artifacts.map(artifact => {
                const isStatic = artifact.key.startsWith('static/');
                const displayKey = isStatic ? artifact.key.slice(7) : artifact.key;

                return (
                  <EntryList.Entry
                    key={artifact.key}
                    entry={{ id: artifact.key }}
                    columns={columns}
                    onClick={() => onView?.(artifact.key)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded ${getTypeStyle(artifact.type)}`}>
                        {getArtifactIcon(artifact.type)}
                      </div>
                      <span className="font-mono text-sm text-icon6 truncate">{displayKey}</span>
                      {isStatic && <Lock className="h-3 w-3 text-amber-400 flex-shrink-0" />}
                    </div>
                    <span className={`text-xs capitalize ${getTypeStyle(artifact.type)} px-1.5 py-0.5 rounded`}>
                      {artifact.type}
                    </span>
                    <span className="text-icon4 tabular-nums text-sm">{formatBytes(artifact.size)}</span>
                    <div className="flex justify-end">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setDeleteArtifact(artifact.key);
                        }}
                        className="p-1.5 rounded hover:bg-surface5 text-icon3 hover:text-red-400 transition-colors"
                        title="Delete artifact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </EntryList.Entry>
                );
              })}
            </EntryList.Entries>
          ) : (
            <EntryList.Message message="No artifacts yet. Add one to get started." />
          )}
        </EntryList.Trim>
      </EntryList>

      <AlertDialog open={!!deleteArtifact} onOpenChange={() => setDeleteArtifact(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Artifact</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete "{deleteArtifact}"? This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={() => {
                if (deleteArtifact && onDelete) {
                  onDelete(deleteArtifact);
                }
                setDeleteArtifact(null);
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

function ArtifactTableSkeleton() {
  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={columns} />
        <EntryList.Entries>
          {Array.from({ length: 5 }).map((_, i) => (
            <EntryList.Entry key={i} columns={columns} isLoading>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded bg-surface4 animate-pulse" />
                <div className="h-4 w-48 rounded bg-surface4 animate-pulse" />
              </div>
              <div className="h-5 w-12 rounded bg-surface4 animate-pulse" />
              <div className="h-4 w-14 rounded bg-surface4 animate-pulse" />
              <div />
            </EntryList.Entry>
          ))}
        </EntryList.Entries>
      </EntryList.Trim>
    </EntryList>
  );
}
