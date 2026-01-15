import { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHORTCUT_DEFINITIONS, type ShortcutConfig } from '../hooks/use-keyboard-shortcuts';

// Focus trap hook for modal accessibility
function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return containerRef;
}

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
  const focusTrapRef = useFocusTrap(isOpen);
  const titleId = 'keyboard-shortcuts-title';

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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-surface1 border border-border1 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border1">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-icon4" />
            <h2 id={titleId} className="text-sm font-semibold text-icon6">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-surface3 rounded-lg transition-colors"
            aria-label="Close keyboard shortcuts"
          >
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
