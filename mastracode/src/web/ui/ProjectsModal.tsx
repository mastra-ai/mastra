import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Folder, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { DirectoryBrowser } from './DirectoryPicker';
import type { Project } from './projects';
import { addProject, loadProjects, removeProject } from './projects';

interface ProjectsModalProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (project: Project) => void;
  onProjectsChange: (projects: Project[]) => void;
  onClose: () => void;
}

/**
 * App-level modal for managing projects — the primary entry point into a coding
 * session. A project binds a name to a filesystem path; its threads, memory,
 * and workspace are scoped to that directory (and shared with the terminal).
 *
 * Two views: the project list, and an "add" view that embeds the server-driven
 * directory browser. On first run (no projects) it opens straight into "add".
 */
export function ProjectsModal({
  projects,
  activeProjectId,
  onSelectProject,
  onProjectsChange,
  onClose,
}: ProjectsModalProps) {
  const empty = projects.length === 0;
  const [adding, setAdding] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape backs out of the add view to the list first (when projects exist);
  // the DS Dialog otherwise owns close-on-Escape for the list view.
  useEffect(() => {
    if (!(adding && !empty)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setAdding(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [adding, empty]);

  const handlePick = async (path: string, name: string) => {
    setBusy(true);
    setError(null);
    try {
      // addProject resolves the server-side (TUI-matching) resourceId, then
      // persists to localStorage. Reload so we don't double-append.
      const project = await addProject(name || path, path);
      onProjectsChange(loadProjects());
      onSelectProject(project);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeProject(id);
    onProjectsChange(projects.filter(p => p.id !== id));
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-full max-w-lg" aria-label="Projects">
        <DialogHeader className="px-5 pt-4 pb-2">
          <DialogTitle>{adding ? 'Open a project' : 'Projects'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-5 pb-5">
          {adding ? (
            <>
              <Txt as="p" variant="ui-sm" className="text-icon3">
                Choose a folder on this machine. Its threads, memory, and workspace stay scoped to that directory — and
                are shared with the terminal.
              </Txt>
              <DirectoryBrowser
                onPick={(p, n) => void handlePick(p, n)}
                onCancel={() => (empty ? onClose() : setAdding(false))}
                busy={busy}
                error={error}
              />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {projects.map(p => {
                  const active = p.id === activeProjectId;
                  return (
                    <div
                      key={p.id}
                      className="group relative flex items-center gap-3 rounded-lg border border-border1 bg-surface-overlay-soft p-3 transition-colors hover:border-neutral5/50"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-hidden"
                        onClick={() => {
                          onSelectProject(p);
                          onClose();
                        }}
                        title={p.path}
                      >
                        <Folder size={18} className="shrink-0 text-accent1" />
                        <span className="flex min-w-0 flex-col">
                          <Txt as="span" variant="ui-md" className="truncate text-icon6">
                            {p.name}
                          </Txt>
                          <Txt as="span" variant="ui-xs" className="truncate text-icon3">
                            {p.path}
                          </Txt>
                        </span>
                      </button>
                      {active && (
                        <Txt
                          as="span"
                          variant="ui-xs"
                          className="shrink-0 rounded-full bg-accent1/15 px-2 py-0.5 text-accent1"
                        >
                          Active
                        </Txt>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={e => handleRemove(e, p.id)}
                        aria-label={`Remove ${p.name}`}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>
                <Plus size={16} />
                <span>Add a project</span>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
