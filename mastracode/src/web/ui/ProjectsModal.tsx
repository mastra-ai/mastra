import { useEffect, useState } from 'react';

import { DirectoryBrowser } from './DirectoryPicker';
import { CloseIcon, FolderIcon, LogoMark, PlusIcon } from './icons';
import type { Project } from './projects';
import { addGitProject, addProject, loadProjects, removeProject } from './projects';

interface ProjectsModalProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (project: Project) => void;
  onProjectsChange: (projects: Project[]) => void;
  onClose: () => void;
}

type AddMode = 'git' | 'local';

/**
 * App-level modal for managing projects — the primary entry point into a coding
 * session. A project binds a name to a filesystem path; its threads, memory,
 * and workspace are scoped to that directory (and shared with the terminal).
 *
 * Two views: the project list, and an "add" view for cloning a Git URL or
 * browsing to an existing local folder. On first run (no projects) it opens
 * straight into "add".
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
  const [addMode, setAddMode] = useState<AddMode>('git');
  const [choosingCloneLocation, setChoosingCloneLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitUrl, setGitUrl] = useState('');
  const [cloneParentPath, setCloneParentPath] = useState('');

  // Close on Escape (but if browsing to add, Escape backs out to the list first
  // when there are existing projects).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (choosingCloneLocation) setChoosingCloneLocation(false);
      else if (adding && !empty) setAdding(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adding, choosingCloneLocation, empty, onClose]);

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

  const handleGitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const project = addGitProject(gitUrl, cloneParentPath);
      onProjectsChange(loadProjects());
      onSelectProject(project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCloneLocationPick = (path: string) => {
    setCloneParentPath(path);
    setChoosingCloneLocation(false);
    setError(null);
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
              Start from a Git repository URL, or choose an existing folder on this machine. Each project keeps its own
              threads, memory, and workspace.
            </p>
            <div className="projects-add-tabs" role="tablist" aria-label="Project source">
              <button
                type="button"
                role="tab"
                aria-selected={addMode === 'git'}
                className={`projects-add-tab ${addMode === 'git' ? 'active' : ''}`}
                onClick={() => {
                  setAddMode('git');
                  setChoosingCloneLocation(false);
                  setError(null);
                }}
              >
                Clone from Git
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={addMode === 'local'}
                className={`projects-add-tab ${addMode === 'local' ? 'active' : ''}`}
                onClick={() => {
                  setAddMode('local');
                  setChoosingCloneLocation(false);
                  setError(null);
                }}
              >
                Open local folder
              </button>
            </div>

            {addMode === 'git' ? (
              choosingCloneLocation ? (
                <>
                  <div className="projects-location-head">
                    <span>Choose where to clone this repository</span>
                    <button type="button" className="btn btn-sm" onClick={() => setChoosingCloneLocation(false)}>
                      Back
                    </button>
                  </div>
                  <DirectoryBrowser
                    onPick={p => handleCloneLocationPick(p)}
                    onCancel={() => setChoosingCloneLocation(false)}
                    busy={busy}
                    error={error}
                  />
                </>
              ) : (
                <form className="projects-git-form" onSubmit={handleGitSubmit}>
                  <label className="projects-git-label" htmlFor="project-git-url">
                    Git repository URL
                  </label>
                  <input
                    id="project-git-url"
                    className="input projects-git-input"
                    value={gitUrl}
                    onChange={e => setGitUrl(e.target.value)}
                    placeholder="https://github.com/org/repo.git"
                    disabled={busy}
                  />

                  <label className="projects-git-label" htmlFor="project-clone-location">
                    Clone location
                  </label>
                  <div className="projects-git-row">
                    <input
                      id="project-clone-location"
                      className="input projects-git-input"
                      value={cloneParentPath}
                      readOnly
                      placeholder="Choose a folder…"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      className="btn projects-git-submit"
                      onClick={() => setChoosingCloneLocation(true)}
                    >
                      Choose…
                    </button>
                  </div>
                  <p className="projects-git-hint">
                    MastraCode will clone into a repo-named subfolder inside this location and reuse it for future
                    sessions.
                  </p>
                  {error && <div className="dirbrowser-msg dirbrowser-err projects-git-error">{error}</div>}
                  <div className="projects-git-actions">
                    {!empty && (
                      <button type="button" className="btn" onClick={() => setAdding(false)} disabled={busy}>
                        Cancel
                      </button>
                    )}
                    <button
                      className="btn btn-primary projects-git-submit"
                      type="submit"
                      disabled={busy || !gitUrl.trim() || !cloneParentPath.trim()}
                    >
                      Clone from URL
                    </button>
                  </div>
                </form>
              )
            ) : (
              <DirectoryBrowser
                onPick={(p, n) => void handlePick(p, n)}
                onCancel={() => (empty ? onClose() : setAdding(false))}
                busy={busy}
                error={error}
              />
            )}
          </>
        ) : (
          <>
            <div className="projects-list">
              {projects.map(p => {
                const active = p.id === activeProjectId;
                return (
                  <button
                    key={p.id}
                    className={`project-card ${active ? 'active' : ''}`}
                    onClick={() => {
                      onSelectProject(p);
                      onClose();
                    }}
                    title={p.path}
                  >
                    <FolderIcon size={18} className="project-card-icon" />
                    <span className="project-card-text">
                      <span className="project-card-name">{p.name}</span>
                      <span className="project-card-path">{p.path}</span>
                    </span>
                    {p.source === 'git' && <span className="project-card-badge secondary">Git</span>}
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
