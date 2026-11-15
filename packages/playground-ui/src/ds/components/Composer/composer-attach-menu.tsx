import { Camera, Images } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { DIALOG_DRAWER_BREAKPOINT_PX } from '@/ds/components/Dialog/dialog-shell';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/ds/components/Drawer';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconFileText } from '@/ds/icons/central/IconFileText';
import { IconPlusLarge } from '@/ds/icons/central/IconPlusLarge';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/utils/cn';

export interface ComposerAttachAction {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}

export interface ComposerAttachMenuProps {
  /** Called with the files picked from any source. */
  onFiles: (files: File[]) => void;
  /** `accept` for the Files source, e.g. `image/*`. Camera and Photos always take images. */
  accept?: string;
  disabled?: boolean;
  /** Accessible name and tooltip of the "+" trigger. */
  label?: string;
  size?: 'icon-sm' | 'icon-md';
  /** Extra entries after the sources, e.g. "From a URL…". */
  actions?: readonly ComposerAttachAction[];
}

const SOURCES = [
  // `capture` is ignored on desktop browsers, so the camera entry only shows where it opens a camera.
  { key: 'camera', label: 'Camera', icon: <Camera />, className: 'pointer-fine:hidden' },
  { key: 'photos', label: 'Photos', icon: <Images /> },
  { key: 'files', label: 'Files', icon: <IconFileText /> },
];

/**
 * The composer's "+" attach control: a menu of attachment sources that opens above the trigger, and the
 * design system's bottom Drawer on phones so it swipes closed.
 */
export function ComposerAttachMenu({
  onFiles,
  accept,
  disabled,
  label = 'Add attachment',
  size = 'icon-sm',
  actions = [],
}: ComposerAttachMenuProps) {
  const sheet = useIsMobile(DIALOG_DRAWER_BREAKPOINT_PX);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The inputs live outside the portaled menu so closing it after a pick doesn't unmount them before the
  // browser reports the files.
  const inputs = useRef<Record<string, HTMLInputElement | undefined>>({});

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Clear so picking the same file again still fires `change`.
    event.target.value = '';
    if (files.length > 0) onFiles(files);
  };

  const entries = [
    ...SOURCES.map(source => ({ ...source, onSelect: () => inputs.current[source.key]?.click() })),
    ...actions.map(action => ({ key: action.label, className: undefined, ...action })),
  ];
  // Your own actions follow the sources behind a divider.
  const separatorBefore = SOURCES.length;

  const fileInputs = SOURCES.map(({ key, label }) => (
    <input
      key={key}
      ref={element => {
        inputs.current[key] = element ?? undefined;
      }}
      type="file"
      hidden
      tabIndex={-1}
      aria-label={label}
      multiple={key !== 'camera'}
      accept={key === 'files' ? accept : 'image/*'}
      capture={key === 'camera' ? 'environment' : undefined}
      disabled={disabled}
      onChange={onChange}
    />
  ));

  if (sheet) {
    return (
      <>
        <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
          <DrawerTrigger
            disabled={disabled}
            aria-label={label}
            render={
              <Button variant="ghost" size={size} tooltip={label}>
                <IconPlusLarge />
              </Button>
            }
          />
          <DrawerContent showCloseButton={false} className="pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <DrawerTitle className="sr-only">{label}</DrawerTitle>
            <ul className="flex flex-col px-2">
              {entries.map((entry, index) => (
                <li
                  key={entry.key}
                  className={cn(entry.className, index === separatorBefore && 'mt-1 border-t border-border pt-1')}
                >
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-start gap-3 px-3"
                    onClick={() => {
                      setSheetOpen(false);
                      entry.onSelect();
                    }}
                  >
                    {entry.icon}
                    {entry.label}
                  </Button>
                </li>
              ))}
            </ul>
            {/* Fills the drawer's 3rem swipe bleed below the screen edge, as Dialog does. */}
            <div aria-hidden className="h-12 shrink-0" />
          </DrawerContent>
        </Drawer>
        {fileInputs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger variant="ghost" size={size} aria-label={label} tooltip={label} disabled={disabled}>
          <IconPlusLarge />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="top" align="start">
          {entries.map((entry, index) => (
            <Fragment key={entry.key}>
              {index === separatorBefore ? <DropdownMenu.Separator /> : null}
              <DropdownMenu.Item className={entry.className} onClick={entry.onSelect}>
                {entry.icon}
                {entry.label}
              </DropdownMenu.Item>
            </Fragment>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>
      {fileInputs}
    </>
  );
}
