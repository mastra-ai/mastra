import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Folder, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { useKeyDown } from '../../../lib/hooks';
import { useOverlays } from '../../../lib/overlays';
import { useAddProjectMutation, useRemoveProjectMutation } from '../hooks/useProjects';
import { useActiveProjectContext } from '../context/ActiveProjectProvider';
import { DirectoryBrowser } from './DirectoryPicker';

/** App-level project manager backed by the active-project and overlay providers. */
export function ProjectsModal() {
  const { close } = useOverlays();
  const { projects, activeProject, selectProject } = useActiveProjectContext();
  const empty = projects.length === 0;
  const [adding, setAdding] = useState(empty);
  const addProject = useAddProjectMutation();
  const removeProject = useRemoveProjectMutation();
  const busy = addProject.isPending;
  const error = addProject.error instanceof Error ? addProject.error.message : addProject.error ? String(addProject.error) : null;

  useKeyDown({ escape: e => { e.stopPropagation(); setAdding(false); } }, { capture: true, enabled: adding && !empty });

  const handlePick = async (path: string, name: string) => {
    try {
      const project = await addProject.mutateAsync({ name: name || path, path });
      await selectProject(project);
      close('projects');
    } catch {
      // Mutation state owns the rendered error.
    }
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeProject.mutate(id);
  };

  return (
    <Dialog open onOpenChange={open => !open && close('projects')}>
      <DialogContent className="w-full max-w-lg" aria-label="Projects">
        <DialogHeader className="px-5 pt-4 pb-2"><DialogTitle>{adding ? 'Open a project' : 'Projects'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3 px-5 pb-5">
          {adding ? (
            <>
              <Txt as="p" variant="ui-sm" className="text-icon3">
                Choose a folder on this machine. Its threads, memory, and workspace stay scoped to that directory — and are shared with the terminal.
              </Txt>
              <DirectoryBrowser onPick={(p, n) => void handlePick(p, n)} onCancel={() => (empty ? close('projects') : setAdding(false))} busy={busy} error={error} />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {projects.map(project => {
                  const active = project.id === activeProject?.id;
                  return (
                    <div key={project.id} className="group relative flex items-center gap-3 rounded-lg border border-border1 bg-surface-overlay-soft p-3 transition-colors hover:border-neutral5/50">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-hidden"
                        onClick={() => { void selectProject(project); close('projects'); }}
                        title={project.path}
                      >
                        <Folder size={18} className="shrink-0 text-accent1" />
                        <span className="flex min-w-0 flex-col">
                          <Txt as="span" variant="ui-md" className="truncate text-icon6">{project.name}</Txt>
                          <Txt as="span" variant="ui-xs" className="truncate text-icon3">{project.path}</Txt>
                        </span>
                      </button>
                      {active && <Txt as="span" variant="ui-xs" className="shrink-0 rounded-full bg-accent1/15 px-2 py-0.5 text-accent1">Active</Txt>}
                      <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={e => handleRemove(e, project.id)} aria-label={`Remove ${project.name}`}><X size={14} /></Button>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}><Plus size={16} /><span>Add a project</span></Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
