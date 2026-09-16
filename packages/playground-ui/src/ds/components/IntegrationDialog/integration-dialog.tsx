import { BlocksIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Badge } from '@/ds/components/Badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ds/components/Dialog';
import type { DialogProps } from '@/ds/components/Dialog';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';
import { controlFocusBorderVisible } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

export type IntegrationDialogItem = {
  id: string;
  name: string;
  logo?: ReactNode;
  badge?: string;
  meta?: string;
  disabled?: boolean;
};

export type IntegrationDialogProps = Omit<DialogProps, 'variant' | 'intent' | 'children'> & {
  title: ReactNode;
  description?: ReactNode;
  items: IntegrationDialogItem[];
  onSelect: (item: IntegrationDialogItem) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  emptyMessage?: ReactNode;
  children?: ReactNode;
  className?: string;
};

function matches(item: IntegrationDialogItem, query: string) {
  return `${item.name} ${item.id} ${item.badge ?? ''}`.toLowerCase().includes(query);
}

function IntegrationDialog({
  title,
  description,
  items,
  onSelect,
  searchPlaceholder = 'Search integrations',
  searchLabel = 'Search integrations',
  emptyMessage,
  children,
  className,
  ...props
}: IntegrationDialogProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog variant="new" {...props}>
      {children}
      <DialogContent className={cn('max-w-lg', className)} initialFocus={searchRef}>
        <IntegrationDialogContent
          searchRef={searchRef}
          title={title}
          description={description}
          items={items}
          onSelect={onSelect}
          searchPlaceholder={searchPlaceholder}
          searchLabel={searchLabel}
          emptyMessage={emptyMessage}
        />
      </DialogContent>
    </Dialog>
  );
}

type IntegrationDialogContentProps = Pick<
  IntegrationDialogProps,
  'title' | 'description' | 'items' | 'onSelect' | 'emptyMessage'
> &
  Required<Pick<IntegrationDialogProps, 'searchPlaceholder' | 'searchLabel'>> & {
    searchRef: RefObject<HTMLInputElement | null>;
  };

function IntegrationDialogContent({
  title,
  description,
  items,
  onSelect,
  searchPlaceholder,
  searchLabel,
  emptyMessage,
  searchRef,
}: IntegrationDialogContentProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = normalizedQuery ? items.filter(item => matches(item, normalizedQuery)) : items;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      <div className="shrink-0 px-5 py-2">
        <SearchFieldBlock
          inputRef={searchRef}
          name="integration-search"
          label={searchLabel}
          labelIsHidden
          placeholder={searchPlaceholder}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onReset={() => setQuery('')}
          variant="outline"
          size="md"
        />
      </div>
      <DialogBody className="pt-2 pb-5">
        {visibleItems.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visibleItems.map(item => {
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => onSelect(item)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border1 px-4 py-3 text-left transition-colors duration-normal ease-out-custom hover:bg-surface3 disabled:pointer-events-none disabled:opacity-50',
                      controlFocusBorderVisible,
                    )}
                  >
                    <span className="text-neutral4 grid size-8 shrink-0 place-items-center [&>img]:size-full [&>img]:object-contain [&>svg]:size-4">
                      {item.logo ?? <BlocksIcon />}
                    </span>
                    <span className="text-ui-md leading-ui-md text-neutral6 min-w-0 truncate font-medium">
                      {item.name}
                    </span>
                    {item.badge ? <Badge size="sm">{item.badge}</Badge> : null}
                    {item.meta ? (
                      <span className="text-ui-sm leading-ui-sm text-neutral3 ml-auto shrink-0">{item.meta}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" className="text-ui-sm text-neutral3 py-8 text-center">
            {emptyMessage ?? (normalizedQuery ? `No integrations match “${query}”.` : 'No integrations are available.')}
          </p>
        )}
      </DialogBody>
    </>
  );
}

IntegrationDialog.Trigger = DialogTrigger;

export { IntegrationDialog };
