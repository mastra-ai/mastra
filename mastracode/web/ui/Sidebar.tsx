import type { HarnessThreadInfo } from '@mastra/client-js';
import { useState } from 'react';

import type { Project } from './projects';
import { addProject, removeProject } from './projects';

const MAX_THREADS = 5;

/** Whether the browser supports the File System Access API (Chromium). */
const hasDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

interface SidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (project: Project | null) => void;
  onProjectsChange: (projects: Project[]) => void;
  threads: HarnessThreadInfo[];
  activeThreadId?: string;
  onSwitchThread: (threadId: string) => void;
  onCreateThread: (title?: string) => void;
  onDeleteThread: (threadId: string) => void;
}

export function Sidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onProjectsChange,
  threads,
  activeThreadId,
  onSwitchThread,
  onCreateThread,
  onDeleteThread,
}: SidebarProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPath, setAddPath] = useState('');

  // ── Project handlers ──────────────────────────────────────────────────

  const handlePickDirectory = async () => {
    if (hasDirectoryPicker) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const dirName = handle.name as string;
        const absPath = prompt(
          `Selected: "${dirName}"\n\nThe browser can't read the full path. Enter the absolute path:`,
          dirName,
        );
        if (!absPath) return;
        const project = addProject(dirName, absPath.trim());
        onProjectsChange([...projects, project]);
        onSelectProject(project);
      } catch {
        // cancelled
      }
    } else {
      setShowAddForm(true);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addPath.trim()) return;
    const project = addProject(addName, addPath);
    setAddName('');
    setAddPath('');
    setShowAddForm(false);
    onProjectsChange([...projects, project]);
    onSelectProject(project);
  };

  const handleRemoveProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeProject(id);
    onProjectsChange(projects.filter(p => p.id !== id));
    if (activeProjectId === id) onSelectProject(null);
  };

  // ── Threads: sorted by most recent, limited to 5 ─────────────────────

  const sortedThreads = [...threads]
    .sort((a, b) => {
      const ta = a.updatedAt ?? a.createdAt ?? '';
      const tb = b.updatedAt ?? b.createdAt ?? '';
      return tb.localeCompare(ta);
    })
    .slice(0, MAX_THREADS);

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="sidebar">
      {/* ── Projects ──────────────────────────────────────────────────── */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">Projects</span>
          <div className="sidebar-section-actions">
            {hasDirectoryPicker && (
              <button className="sidebar-icon-btn" title="Enter path manually" onClick={() => setShowAddForm(s => !s)}>
                ✏️
              </button>
            )}
            <button className="sidebar-icon-btn" title="Add project" onClick={() => void handlePickDirectory()}>
              +
            </button>
          </div>
        </div>

        <div className="sidebar-project-list">
          {projects.map(p => (
            <button
              key={p.id}
              className={`sidebar-project ${p.id === activeProjectId ? 'active' : ''}`}
              onClick={() => onSelectProject(p)}
              title={p.path}
            >
              <span className="sidebar-project-name">{p.name}</span>
              <span className="sidebar-project-path">{p.path}</span>
              <span className="sidebar-project-remove" onClick={e => handleRemoveProject(e, p.id)} title="Remove">×</span>
            </button>
          ))}

          {projects.length === 0 && !showAddForm && (
            <div className="sidebar-empty">No projects yet</div>
          )}
        </div>

        {showAddForm && (
          <form className="sidebar-add-form" onSubmit={handleAddSubmit}>
            <input className="input input-sm" placeholder="Project name" value={addName} onChange={e => setAddName(e.target.value)} autoFocus />
            <input className="input input-sm" placeholder="/absolute/path" value={addPath} onChange={e => setAddPath(e.target.value)} />
            <div className="sidebar-add-actions">
              <button type="submit" className="btn btn-sm btn-primary" disabled={!addName.trim() || !addPath.trim()}>Add</button>
              <button type="button" className="btn btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* ── Threads (scoped to active project) ────────────────────────── */}
      {activeProject && (
      <div className="sidebar-section sidebar-section-grow">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">{activeProject.name} threads</span>
          <button
            className="sidebar-icon-btn"
            title="New thread"
            onClick={() => onCreateThread()}
          >
            +
          </button>
        </div>

        <div className="sidebar-list">
          {sortedThreads.length === 0 && (
            <div className="sidebar-empty">No threads yet</div>
          )}
          {sortedThreads.map(t => (
            <button
              key={t.id}
              className={`sidebar-thread ${t.id === activeThreadId ? 'active' : ''}`}
              onClick={() => onSwitchThread(t.id)}
            >
              <span className="sidebar-thread-title">{t.title || t.id.slice(0, 12)}</span>
              {t.updatedAt && (
                <span className="sidebar-thread-date">{new Date(t.updatedAt).toLocaleDateString()}</span>
              )}
              <span
                className="sidebar-thread-remove"
                onClick={e => { e.stopPropagation(); onDeleteThread(t.id); }}
                title="Delete"
              >
                ×
              </span>
            </button>
          ))}
          {threads.length > MAX_THREADS && (
            <div className="sidebar-overflow">+{threads.length - MAX_THREADS} more</div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
