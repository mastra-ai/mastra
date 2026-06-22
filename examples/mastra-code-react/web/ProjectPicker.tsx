import { useState } from 'react';

import type { Project } from './projects';
import { addProject, removeProject } from './projects';

interface ProjectPickerProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (project: Project | null) => void;
  onProjectsChange: (projects: Project[]) => void;
}

/** Whether the browser supports the File System Access API (Chromium). */
const hasDirectoryPicker = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export function ProjectPicker({ projects, activeProjectId, onSelect, onProjectsChange }: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  // Fallback form for browsers without showDirectoryPicker
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackName, setFallbackName] = useState('');
  const [fallbackPath, setFallbackPath] = useState('');

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  const handlePickDirectory = async () => {
    if (hasDirectoryPicker) {
      try {
        // showDirectoryPicker returns a FileSystemDirectoryHandle
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const dirName = handle.name as string;
        // The File System Access API doesn't expose the absolute path for security.
        // We use the directory name as both name and a server-resolvable hint.
        // For a local dev server (mastra dev), the user provides the full path.
        // Prompt for the absolute path since the API doesn't expose it.
        const absPath = prompt(
          `Selected: "${dirName}"\n\nThe browser can't read the full path. Enter the absolute path:`,
          dirName,
        );
        if (!absPath) return;
        const project = addProject(dirName, absPath.trim());
        onProjectsChange([...projects, project]);
        onSelect(project);
        setOpen(false);
      } catch {
        // User cancelled the picker
      }
    } else {
      setShowFallback(true);
    }
  };

  const handleFallbackAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fallbackName.trim() || !fallbackPath.trim()) return;
    const project = addProject(fallbackName, fallbackPath);
    setFallbackName('');
    setFallbackPath('');
    setShowFallback(false);
    onProjectsChange([...projects, project]);
    onSelect(project);
    setOpen(false);
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeProject(id);
    onProjectsChange(projects.filter(p => p.id !== id));
    if (activeProjectId === id) onSelect(null);
  };

  return (
    <div className="project-picker">
      <button
        className="project-picker-trigger"
        onClick={() => setOpen(o => !o)}
        title={activeProject ? activeProject.path : 'No project selected'}
      >
        <span className="project-picker-icon">📁</span>
        <span className="project-picker-label">
          {activeProject ? activeProject.name : 'No project'}
        </span>
        <span className="project-picker-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="project-picker-dropdown">
          <button
            className={`project-picker-item ${!activeProjectId ? 'active' : ''}`}
            onClick={() => { onSelect(null); setOpen(false); }}
          >
            <span className="project-item-name">(default workspace)</span>
          </button>

          {projects.map(p => (
            <button
              key={p.id}
              className={`project-picker-item ${p.id === activeProjectId ? 'active' : ''}`}
              onClick={() => { onSelect(p); setOpen(false); }}
              title={p.path}
            >
              <span className="project-item-name">{p.name}</span>
              <span className="project-item-path">{p.path}</span>
              <span
                className="project-item-remove"
                onClick={e => handleRemove(e, p.id)}
                title="Remove project"
              >
                ×
              </span>
            </button>
          ))}

          <div className="project-picker-divider" />

          {showFallback ? (
            <form className="project-add-form" onSubmit={handleFallbackAdd}>
              <input
                className="project-add-input"
                placeholder="Project name"
                value={fallbackName}
                onChange={e => setFallbackName(e.target.value)}
                autoFocus
              />
              <input
                className="project-add-input"
                placeholder="/absolute/path/to/project"
                value={fallbackPath}
                onChange={e => setFallbackPath(e.target.value)}
              />
              <div className="project-add-actions">
                <button type="submit" className="btn btn-sm" disabled={!fallbackName.trim() || !fallbackPath.trim()}>
                  Add
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setShowFallback(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="project-add-row">
              <button className="project-picker-item project-add-btn" onClick={() => void handlePickDirectory()}>
                + Add Project
              </button>
              {hasDirectoryPicker && (
                <button
                  className="project-picker-item project-add-btn-alt"
                  onClick={() => setShowFallback(true)}
                  title="Enter path manually"
                >
                  ✏️
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
