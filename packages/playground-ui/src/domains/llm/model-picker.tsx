import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { modelDisplayName } from './model-display-name';
import { ModelPickerPanel } from './model-picker-panel';
import type {
  ModelPickerAddProvider,
  ModelPickerModel,
  ModelPickerProvider,
  ModelPickerValue,
} from './model-picker-types';
import { ProviderLogo } from './provider-logo';
import { Button } from '@/ds/components/Button';
import { DIALOG_DRAWER_BREAKPOINT_PX } from '@/ds/components/Dialog/dialog-shell';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/ds/components/Drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/utils/cn';
import { formatModelName } from '@/utils/model';

export interface ModelPickerProps {
  /** Providers in display order, each with its models in display order. */
  providers: ModelPickerProvider[];
  value?: ModelPickerValue;
  onValueChange: (value: ModelPickerValue) => void;
  /** Marked "Default" in the list. */
  defaultModel?: ModelPickerValue;
  /** Trigger content. Defaults to the selected provider's icon and the selected model's name. */
  children?: ReactNode;
  renderProviderIcon?: (providerId: string) => ReactNode;
  /** Above the search field, e.g. the credential the selected model runs on. */
  header?: ReactNode;
  /**
   * Controls for the selected model below the list, e.g. its thinking level. Rendered outside the
   * command list so sliders and other inputs keep their own arrow-key handling.
   */
  settings?: ReactNode;
  /** A "+" at the end of the search field, e.g. a link to connect another provider. */
  addProvider?: ModelPickerAddProvider;
  /** Labels an action that picks `defaultModel`, shown while another model is picked. */
  resetLabel?: string;
  /** Open filtered to the selected model's provider instead of "All". Suits large catalogs. */
  openOnSelectedProvider?: boolean;
  disabled?: boolean;
  busy?: boolean;
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
  triggerClassName?: string;
  'aria-label'?: string;
  title?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

const defaultProviderIcon = (providerId: string) => <ProviderLogo providerId={providerId} size={14} />;

/** The catalog's name for the selected model, else a readable form of its id. */
function triggerLabel(selectedModel: ModelPickerModel | undefined, value: ModelPickerValue | undefined) {
  if (selectedModel) return modelDisplayName(selectedModel);
  if (value?.model) return formatModelName(value.model);
  return 'Select model';
}

/**
 * One trigger for provider and model: a ghost button with the provider's icon and the model's name. It
 * opens a searchable list filtered by provider: a popover beside the trigger, and the design system's
 * bottom Drawer on phones so it swipes closed. Searching looks across every provider.
 */
export function ModelPicker({
  providers,
  value,
  onValueChange,
  defaultModel,
  children,
  renderProviderIcon = defaultProviderIcon,
  header,
  settings,
  addProvider,
  resetLabel,
  openOnSelectedProvider = false,
  disabled,
  busy,
  side = 'top',
  align = 'end',
  triggerClassName,
  'aria-label': ariaLabel,
  title,
  searchPlaceholder = 'Search models',
  emptyText = 'No matching model.',
}: ModelPickerProps) {
  const sheet = useIsMobile(DIALOG_DRAWER_BREAKPOINT_PX);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>();

  const selectedProvider = providers.find(provider => provider.id === value?.provider);
  const selectedModel = selectedProvider?.models.find(model => model.id === value?.model);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    setQuery('');
    setProviderFilter(
      next && openOnSelectedProvider && providers.length > 1 && selectedProvider ? selectedProvider.id : undefined,
    );
  };
  const close = () => changeOpen(false);
  const select = (next: ModelPickerValue) => {
    close();
    if (next.provider !== value?.provider || next.model !== value?.model) onValueChange(next);
  };

  const triggerProps = {
    type: 'button' as const,
    disabled: disabled || busy,
    'aria-label': ariaLabel,
    'aria-busy': busy,
    title: title ?? (value ? `${value.provider}/${value.model}` : undefined),
  };
  const triggerClass = cn('max-w-full min-w-0 gap-1.5', triggerClassName);
  const triggerContent = (
    <>
      {children ?? (
        <>
          <span className="sr-only">Model: </span>
          {value?.provider ? <span className="flex shrink-0">{renderProviderIcon(value.provider)}</span> : null}
          <span className="truncate max-sm:max-w-28">{triggerLabel(selectedModel, value)}</span>
        </>
      )}
      <ChevronDown aria-hidden className="shrink-0" size={12} />
    </>
  );
  const panel = (
    <ModelPickerPanel
      providers={providers}
      value={value}
      defaultModel={defaultModel}
      onSelect={select}
      query={query}
      onQueryChange={setQuery}
      providerFilter={providerFilter}
      onProviderFilterChange={setProviderFilter}
      renderProviderIcon={renderProviderIcon}
      header={header}
      settings={settings}
      addProvider={addProvider}
      resetLabel={resetLabel}
      onAddProvider={close}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      sheet={sheet}
    />
  );

  if (sheet) {
    return (
      <Drawer open={open} onOpenChange={changeOpen}>
        <DrawerTrigger
          {...triggerProps}
          render={
            <Button variant="ghost" size="sm" className={triggerClass}>
              {triggerContent}
            </Button>
          }
        />
        {/* Focusing search on open would raise the keyboard over the sheet; it stays one tap away. */}
        <DrawerContent
          showCloseButton={false}
          initialFocus={false}
          // The muted frame matches the popover, so the inset card reads the same in both themes. The
          // handle is muted too, so it takes the side handle's stronger fill to stay visible on the frame.
          className="bg-muted pb-[max(0.75rem,env(safe-area-inset-bottom))] **:data-[slot=drawer-handle]:bg-border-strong"
        >
          <DrawerTitle className="sr-only">Choose a model</DrawerTitle>
          {panel}
          {/* Fills the drawer's 3rem swipe bleed below the screen edge, as Dialog does. */}
          <div aria-hidden className="h-12 shrink-0" />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger {...triggerProps} variant="ghost" size="sm" className={triggerClass}>
        {triggerContent}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        // An inset card holds search and the list; the header and settings sit on the frame around it.
        className="w-80 rounded-[calc(var(--radius-xl)+--spacing(1))] bg-muted p-1"
        // A touch open (e.g. a tablet) would raise the keyboard over the list; search stays one tap away.
        initialFocus={openType => openType !== 'touch'}
      >
        {panel}
      </PopoverContent>
    </Popover>
  );
}
