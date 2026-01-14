import { X, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHORTCUT_DEFINITIONS, type ShortcutConfig } from '../hooks/use-keyboard-shortcuts';

// ============================================================================
// Props
// ============================================================================

export interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const CATEGORY_INFO: Record<ShortcutConfig['category'], { label: string; order: number }> = {
  general: { label: 'General', order: 0 },
  editing: { label: 'Editing', order: 1 },
  selection: { label: 'Selection', order: 2 },
  view: { label: 'View', order: 3 },
  navigation: { label: 'Navigation', order: 4 },
};

function groupByCategory(shortcuts: ShortcutConfig[]): Record<string, ShortcutConfig[]> {
  const groups: Record<string, ShortcutConfig[]> = {};

  for (const shortcut of shortcuts) {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
  }

  return groups;
}

function KeyBadge({ keys }: { keys: string }) {
  // Split by + and render each key separately
  const parts = keys.split(/\s*\+\s*/);

  return (
    <div className="flex items-center gap-1">
      {parts.map((key, i) => (
        <span key={i}>
          {i > 0 && <span className="text-icon3 mx-0.5">+</span>}
          <kbd
            className={cn(
              'inline-flex items-center justify-center',
              'min-w-[24px] h-6 px-1.5',
              'bg-surface4 border border-border2 rounded',
              'text-[11px] font-mono text-icon5',
              'shadow-sm',
            )}
          >
            {key.replace('Ctrl/Cmd', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')}
          </kbd>
        </span>
      ))}
    </div>
  );
}

function ShortcutRow({ shortcut }: { shortcut: ShortcutConfig }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-icon5">{shortcut.description}</span>
      <KeyBadge keys={shortcut.keys} />
    </div>
  );
}

function CategorySection({ category, shortcuts }: { category: string; shortcuts: ShortcutConfig[] }) {
  const info = CATEGORY_INFO[category as ShortcutConfig['category']];

  return (
    <div>
      <h3 className="text-xs font-semibold text-icon4 uppercase tracking-wide mb-2">{info?.label || category}</h3>
      <div className="space-y-1 divide-y divide-border1">
        {shortcuts.map(shortcut => (
          <ShortcutRow key={shortcut.id} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  if (!isOpen) return null;

  const grouped = groupByCategory(SHORTCUT_DEFINITIONS);
  const sortedCategories = Object.entries(grouped).sort(([a], [b]) => {
    const orderA = CATEGORY_INFO[a as ShortcutConfig['category']]?.order ?? 99;
    const orderB = CATEGORY_INFO[b as ShortcutConfig['category']]?.order ?? 99;
    return orderA - orderB;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-surface1 border border-border1 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border1">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-icon4" />
            <h2 className="text-sm font-semibold text-icon6">Keyboard Shortcuts</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-surface3 rounded-lg transition-colors">
            <X className="w-4 h-4 text-icon3" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {sortedCategories.map(([category, shortcuts]) => (
            <CategorySection key={category} category={category} shortcuts={shortcuts} />
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border1 bg-surface2 rounded-b-xl">
          <p className="text-[10px] text-icon3 text-center">
            Press <kbd className="px-1 py-0.5 bg-surface4 rounded text-icon4 font-mono">?</kbd> anytime to show this
            panel
          </p>
        </div>
      </div>
    </div>
  );
}
