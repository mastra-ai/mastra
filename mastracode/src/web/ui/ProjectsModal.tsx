import { useEffect, useState } from 'react';

import { DirectoryBrowser } from './DirectoryPicker';
import { CloseIcon, FolderIcon, GithubIcon, LogoMark, PlusIcon } from './icons';
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

  // Close on Escape (but if browsing to add, Escape backs out to the list first
  // when there are existing projects).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (adding && !empty) setAdding(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adding, empty, onClose]);

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
    <div className="palette-overlay" onClick={onClose}>
      <div
        className="projects-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Projects"
        onClick={e => e.stopPropagation()}
      >
        <div className="projects-head">
          <div className="projects-head-title">
            <LogoMark size={20} className="logo-mark" />
            <span>{adding ? 'Open a project' : 'Projects'}</span>
          </div>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>

        {adding ? (
          <>
            <p className="projects-sub">
              Choose a folder on this machine. Its threads, memory, and workspace stay scoped to that directory — and
              are shared with the terminal.
            </p>
            <DirectoryBrowser
              onPick={(p, n) => void handlePick(p, n)}
              onCancel={() => (empty ? onClose() : setAdding(false))}
              busy={busy}
              error={error}
            />
          </>
        ) : (
          <>
            <div className="projects-list">
              {projects.map(p => {
                const active = p.id === activeProjectId;
                const isGithub = p.source === 'github';
                return (
                  <button
                    key={p.id}
                    className={`project-card ${active ? 'active' : ''}`}
                    onClick={() => {
                      onSelectProject(p);
                      onClose();
                    }}
                    title={isGithub ? 'GitHub repository' : p.path}
                  >
                    {isGithub ? (
                      <GithubIcon size={18} className="project-card-icon" />
                    ) : (
                      <FolderIcon size={18} className="project-card-icon" />
                    )}
                    <span className="project-card-text">
                      <span className="project-card-name" title={p.name}>
                        {p.name}
                      </span>
                      {/* For GitHub projects `name` is the `owner/repo` identifier; keep it
                          visible and show the tracked branch (when known) in the subtitle
                          instead of a redundant "GitHub repo" label. */}
                      <span className="project-card-path" title={isGithub ? p.name : p.path}>
                        {isGithub ? (p.gitBranch ? `branch: ${p.gitBranch}` : 'GitHub repo') : p.path}
                      </span>
                    </span>
                    <span className={`project-card-source ${isGithub ? 'github' : 'local'}`}>
                      {isGithub ? 'GitHub' : 'Local'}
                    </span>
                    {active && <span className="project-card-badge">Active</span>}
                    <span
                      className="project-card-remove"
                      onClick={e => handleRemove(e, p.id)}
                      title="Remove project"
                      aria-label={`Remove ${p.name}`}
                    >
                      <CloseIcon size={14} />
                    </span>
                  </button>
                );
              })}
            </div>

            <button className="projects-add-btn" onClick={() => setAdding(true)}>
              <PlusIcon size={16} />
              <span>Add a project</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
