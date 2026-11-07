import { Camera, FileText, Images, Plus } from 'lucide-react';
import { useRef } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { mobileSheetPopupClass, mobileSheetPositionerClass } from '@/ds/primitives/mobile-sheet';

export type ComposerAttachSource = 'camera' | 'photos' | 'files';

export interface ComposerAttachMenuProps {
  /** Called with the files picked from any source. */
  onFiles: (files: File[]) => void;
  /** Sources offered, in order. Camera only shows on touch devices, where the browser can open it. */
  sources?: readonly ComposerAttachSource[];
  /** `accept` for the Files source, e.g. `image/*`. Camera and Photos always take images. */
  accept?: string;
  disabled?: boolean;
  /** Accessible name and tooltip of the "+" trigger. */
  label?: string;
  size?: 'icon-sm' | 'icon-md';
  /** Extra menu items after the sources, e.g. "From a URL…". */
  children?: ReactNode;
}

const SOURCE_ITEMS: Record<ComposerAttachSource, { label: string; icon: ReactNode; className?: string }> = {
  // `capture` is ignored on desktop browsers, so the camera entry only shows where it opens a camera.
  camera: { label: 'Camera', icon: <Camera />, className: 'pointer-fine:hidden' },
  photos: { label: 'Photos', icon: <Images /> },
  files: { label: 'Files', icon: <FileText /> },
};

/**
 * The composer's "+" attach control: a menu of attachment sources that opens above the trigger, and as a
 * bottom sheet on small screens.
 */
export function ComposerAttachMenu({
  onFiles,
  sources = ['camera', 'photos', 'files'],
  accept,
  disabled,
  label = 'Add attachment',
  size = 'icon-sm',
  children,
}: ComposerAttachMenuProps) {
  // The inputs live outside the portaled menu so closing the menu after a pick doesn't unmount them
  // before the browser reports the files.
  const inputs = useRef<Partial<Record<ComposerAttachSource, HTMLInputElement>>>({});

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Clear so picking the same file again still fires `change`.
    event.target.value = '';
    if (files.length > 0) onFiles(files);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger variant="ghost" size={size} aria-label={label} tooltip={label} disabled={disabled}>
          <Plus />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          side="top"
          align="start"
          positionerClassName={mobileSheetPositionerClass}
          className={mobileSheetPopupClass}
        >
          {sources.map(source => (
            <DropdownMenu.Item
              key={source}
              className={SOURCE_ITEMS[source].className}
              onClick={() => inputs.current[source]?.click()}
            >
              {SOURCE_ITEMS[source].icon}
              {SOURCE_ITEMS[source].label}
            </DropdownMenu.Item>
          ))}
          {children}
        </DropdownMenu.Content>
      </DropdownMenu>
      {sources.map(source => (
        <input
          key={source}
          ref={element => {
            inputs.current[source] = element ?? undefined;
          }}
          type="file"
          hidden
          tabIndex={-1}
          aria-label={SOURCE_ITEMS[source].label}
          multiple={source !== 'camera'}
          accept={source === 'files' ? accept : 'image/*'}
          capture={source === 'camera' ? 'environment' : undefined}
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </>
  );
}
