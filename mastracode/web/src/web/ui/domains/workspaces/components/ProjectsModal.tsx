import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Folder, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { useKeyDown } from '../../../lib/hooks';
import { useOverlays } from '../../../lib/overlays';
import { GithubIcon } from '../../../ui/icons';
import { useActiveProjectContext } from '../context/ActiveProjectProvider';
import { useGithubStatusQuery } from '../hooks/useGithubStatus';
import { useAddProjectMutation, useRemoveProjectMutation } from '../hooks/useProjects';
import { DirectoryBrowser } from './DirectoryPicker';

/** App-level project manager backed by the active-project and overlay providers. */
export function ProjectsModal() {
  const { close, open } = useOverlays();
  const { projects, activeProject, selectProject } = useActiveProjectContext();
  const empty = projects.length === 0;
  const [adding, setAdding] = useState(empty);
  const addProject = useAddProjectMutation();
  const removeProject = useRemoveProjectMutation();
  const busy = addProject.isPending;
  const error =
    addProject.error instanceof Error ? addProject.error.message : addProject.error ? String(addProject.error) : null;

  // Offer the GitHub entry point whenever the feature isn't hard-disabled:
  // `authRequired` means the status probe hit the auth gate, not that the
  // feature is off (same gating philosophy as the modal's connect button).
  const githubStatus = useGithubStatusQuery().data;
  const githubEnabled = !!githubStatus && (githubStatus.enabled || !!githubStatus.authRequired);
  const openGithub = () => {
    close('projects');
    open('github');
  };

  useKeyDown(
    {
      escape: e => {
        e.stopPropagation();
        setAdding(false);
      },
    },
    { capture: true, enabled: adding && !empty },
  );

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
    <Dialog open onOpenChange={o => !o && close('projects')}>
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
                onCancel={() => (empty ? close('projects') : setAdding(false))}
                busy={busy}
                error={error ?? undefined}
              />
              {githubEnabled && (
                <Button variant="outline" size="sm" className="self-start" onClick={openGithub}>
                  <GithubIcon size={15} />
                  <span>Open from GitHub</span>
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {projects.map(project => {
                  const active = project.id === activeProject?.id;
                  const github = project.source === 'github';
                  const detail = github ? (project.sandboxWorkdir ?? 'cloud sandbox') : project.path;
                  return (
                    <div
                      key={project.id}
                      className="group relative flex items-center gap-3 rounded-lg border border-border1 bg-surface-overlay-soft p-3 transition-colors hover:border-neutral5/50"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-hidden"
                        onClick={() => {
                          void selectProject(project);
                          close('projects');
                        }}
                        title={detail}
                      >
                        {github ? (
                          <GithubIcon size={18} className="shrink-0 text-accent1" />
                        ) : (
                          <Folder size={18} className="shrink-0 text-accent1" />
                        )}
                        <span className="flex min-w-0 flex-col">
                          <Txt as="span" variant="ui-md" className="truncate text-icon6">
                            {project.name}
                            {github && project.gitBranch && (
                              <span className="ml-1.5 text-icon3">· {project.gitBranch}</span>
                            )}
                          </Txt>
                          <Txt as="span" variant="ui-xs" className="truncate text-icon3">
                            {detail}
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
                        onClick={e => handleRemove(e, project.id)}
                        aria-label={`Remove ${project.name}`}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                  <Plus size={16} />
                  <span>Add a project</span>
                </Button>
                {githubEnabled && (
                  <Button variant="outline" size="sm" onClick={openGithub}>
                    <GithubIcon size={15} />
                    <span>Open from GitHub</span>
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
