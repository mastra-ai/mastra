import { ArrowUp, ImagePlus, Plus, Sliders, Square } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

type ActionProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size' | 'children'> & {
  appearance?: 'round' | 'outline';
};

export function ComposerSendButton({ appearance = 'round', className, ...props }: ActionProps) {
  return (
    <Button
      type="submit"
      variant={appearance === 'outline' ? 'outline' : 'default'}
      size={appearance === 'outline' ? 'icon-sm' : 'icon-md'}
      className={cn(appearance === 'round' && 'rounded-full border border-border1 bg-surface5', className)}
      {...props}
    >
      <ArrowUp
        size={appearance === 'outline' ? 16 : 24}
        className={appearance === 'round' ? 'text-neutral3 hover:text-neutral6' : undefined}
      />
    </Button>
  );
}

export function ComposerStopButton({ appearance = 'round', ...props }: ActionProps) {
  return (
    <Button
      type="button"
      variant={appearance === 'outline' ? 'outline' : 'default'}
      size={appearance === 'outline' ? 'icon-sm' : 'icon-md'}
      {...props}
    >
      {appearance === 'outline' ? <Square size={14} /> : <ComposerStopIcon />}
    </Button>
  );
}

function ComposerStopIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral3 hover:text-neutral6"
    >
      <circle cx="12" cy="12" r="10" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
    </svg>
  );
}

export function ComposerAttachmentButton({ appearance = 'round', ...props }: ActionProps) {
  return (
    <Button
      type="button"
      variant={appearance === 'outline' ? 'outline' : 'default'}
      size={appearance === 'outline' ? 'icon-sm' : 'icon-md'}
      {...props}
    >
      {appearance === 'outline' ? (
        <ImagePlus size={14} />
      ) : (
        <Plus className="text-neutral3 hover:text-neutral6 size-5" />
      )}
    </Button>
  );
}

export function ComposerModelSettingsButton(props: Omit<ActionProps, 'appearance'>) {
  return (
    <Button
      variant="default"
      size="icon-md"
      type="button"
      tooltip="Model settings"
      data-testid="composer-model-settings-trigger"
      {...props}
    >
      <Sliders className="text-neutral3 hover:text-neutral6 size-5" />
    </Button>
  );
}
