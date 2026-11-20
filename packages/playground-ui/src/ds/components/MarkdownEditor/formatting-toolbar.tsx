import { Bold, Italic } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formattingActions } from './extensions/markdown-commands';
import type { FormattingAction } from './extensions/markdown-commands';
import type { SelectionToolbar } from './extensions/selection-toolbar';
import { Button } from '@/ds/components/Button';
import { ShortcutHint } from '@/ds/components/Kbd/shortcut-hint';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';
import { IconCodeBrackets } from '@/ds/icons/central/IconCodeBrackets';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import { keyboardShortcutLabel, useIsApplePlatform } from '@/hooks/use-keyboard-shortcut-label';
import { cn } from '@/lib/utils';

const icons: Record<FormattingAction['id'], ReactNode> = {
  bold: <Bold />,
  italic: <Italic />,
  code: <IconCodeBrackets />,
  link: <IconChainLink3 />,
};

const keepEditorFocus = (event: MouseEvent) => event.preventDefault();

export function FormattingToolbar({ toolbar }: { toolbar: SelectionToolbar }) {
  const snapshot = useSyncExternalStore(toolbar.subscribe, toolbar.getSnapshot, () => null);
  const isApplePlatform = useIsApplePlatform();
  if (!snapshot) return null;
  const { host, view, state } = snapshot;

  return createPortal(
    <div
      role="toolbar"
      aria-label="Formatting"
      className={cn(overlaySurfaceStyle, 'flex items-center gap-0.5 rounded-full p-1')}
    >
      {formattingActions.map(action => {
        const active = action.isActive(state);
        const shortcut = keyboardShortcutLabel(action.key, isApplePlatform);
        const key = action.key.toUpperCase();
        return (
          <Button
            key={action.id}
            type="button"
            size="icon-sm"
            variant={active ? 'subtle' : 'ghost'}
            aria-label={action.label}
            aria-pressed={active}
            aria-keyshortcuts={isApplePlatform ? `Meta+${key}` : `Control+${key}`}
            tooltip={<ShortcutHint label={action.label} shortcut={shortcut} />}
            tabIndex={-1}
            onMouseDown={keepEditorFocus}
            onClick={() => action.run(view)}
          >
            {icons[action.id]}
          </Button>
        );
      })}
    </div>,
    host,
  );
}
