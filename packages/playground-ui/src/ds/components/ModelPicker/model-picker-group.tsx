import { Lock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Combobox } from '@/ds/components/Combobox';
import type { ComboboxSingleProps } from '@/ds/components/Combobox';
import { cn } from '@/lib/utils';

export function ModelPickerGroup({ children }: { children: ReactNode }) {
  return (
    <div className="border-border1 bg-surface3 duration-normal focus-within:border-border2 inline-flex max-w-full items-stretch rounded-full border transition-colors">
      {children}
    </div>
  );
}

export function ModelPickerDivider() {
  return <div className="bg-border1 w-px self-stretch" aria-hidden />;
}

export function ModelPickerCombobox({
  segment,
  className,
  ...props
}: ComboboxSingleProps & { segment?: 'provider' | 'model' }) {
  return (
    <Combobox
      {...props}
      className={cn(
        segment &&
          'w-auto min-w-0 gap-1 border-0 bg-transparent px-3 duration-normal hover:bg-surface5 active:bg-surface6 data-[popup-open]:bg-surface5 motion-safe:transition-colors',
        segment === 'provider' &&
          'shrink-0 rounded-none! rounded-l-full @max-md:px-2 @max-md:[&>span>span]:hidden @max-md:[&>svg]:hidden',
        segment === 'model' && 'max-w-40 rounded-none! rounded-r-full',
        className,
      )}
    />
  );
}

export function ModelPickerLocked({ label }: { label: string }) {
  return (
    <div
      className="border-border1 bg-surface3 text-ui-xs text-neutral6 flex items-center gap-1.5 rounded-md border px-2 py-1"
      data-testid="composer-model-locked"
    >
      <Lock className="text-neutral3 size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function ModelPickerWarning({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return (
    <div
      className="text-ui-sm text-accent6 flex max-w-full min-w-0 items-start gap-1"
      data-testid={alert ? 'composer-model-stale-warning' : undefined}
      role={alert ? 'alert' : undefined}
    >
      <TriangleAlert className="mt-0.5 size-3 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export function ModelProviderIcon({ children, connected }: { children: ReactNode; connected: boolean }) {
  return (
    <div className="relative shrink-0">
      {children}
      <div
        className={cn('absolute -top-0.5 -right-0.5 size-1.5 rounded-full', connected ? 'bg-accent1' : 'bg-accent2')}
        title={connected ? 'Connected' : 'Not connected'}
      />
    </div>
  );
}

export function ModelPickerWarnings({
  warning,
  staleModel,
  environmentVariable,
}: {
  warning?: string | string[];
  staleModel?: string;
  environmentVariable?: string;
}) {
  if (!warning && !staleModel && !environmentVariable) return null;
  return (
    <div className="flex flex-col gap-1 px-3 pb-1.5">
      {(warning || staleModel) && (
        <ModelPickerWarning alert>
          {warning || (
            <>
              <code className="bg-accent6Dark text-accent6 rounded px-1 py-0.5 break-all">{staleModel}</code> is no
              longer allowed by admin policy. Pick a different model.
            </>
          )}
        </ModelPickerWarning>
      )}
      {environmentVariable && (
        <ModelPickerWarning>
          Set <code className="bg-accent6Dark text-accent6 rounded px-1 py-0.5 break-all">{environmentVariable}</code>{' '}
          to use this provider
        </ModelPickerWarning>
      )}
    </div>
  );
}
