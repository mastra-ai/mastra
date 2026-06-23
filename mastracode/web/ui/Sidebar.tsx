import type { HarnessThreadInfo } from '@mastra/client-js';
import { useState } from 'react';

import { DirectoryPicker } from './DirectoryPicker';
import type { Project } from './projects';
import { addProject, removeProject } from './projects';

const MAX_THREADS = 5;

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
  const [showPicker, setShowPicker] = useState(false);

  // ── Project handlers ──────────────────────────────────────────────────

  const handlePickFolder = (path: string, name: string) => {
    setShowPicker(false);
    const project = addProject(name || path, path);
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
            <button className="sidebar-icon-btn" title="Add project" onClick={() => setShowPicker(true)}>
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

          {projects.length === 0 && (
            <div className="sidebar-empty">No projects yet</div>
          )}
        </div>

        {showPicker && <DirectoryPicker onPick={handlePickFolder} onCancel={() => setShowPicker(false)} />}
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
