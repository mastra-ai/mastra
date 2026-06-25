interface ShortcutsOverlayProps {
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['⌘', 'K'], description: 'Open the command palette' },
  { keys: ['?'], description: 'Show this shortcuts help' },
  { keys: ['Enter'], description: 'Send the message' },
  { keys: ['Shift', 'Enter'], description: 'Insert a newline' },
  { keys: ['/'], description: 'Start a slash command' },
  { keys: ['Esc'], description: 'Close a dialog, or stop a running turn' },
];

/** A help overlay listing the keyboard shortcuts, triggered by '?'. */
export function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  return (
    <div className="palette-overlay" onClick={onClose}>
      <div
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={e => e.stopPropagation()}
      >
        <div className="settings-head">
          <h2 className="settings-title">Keyboard shortcuts</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close shortcuts">
            ×
          </button>
        </div>
        <ul className="shortcuts-list">
          {SHORTCUTS.map(s => (
            <li key={s.description} className="shortcuts-row">
              <span className="shortcuts-desc">{s.description}</span>
              <span className="shortcuts-keys">
                {s.keys.map(k => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
