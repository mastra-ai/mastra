import { BlocksIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { parseIntegrationName } from './parse-integration-name';
import { Badge } from '@/ds/components/Badge';
import { DialogNew } from '@/ds/components/DialogNew';
import type { DialogNewProps } from '@/ds/components/DialogNew';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';
import { controlFocusBorderVisible } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

export type IntegrationDialogItem = {
  id: string;
  name: string;
  logo?: ReactNode;
  badge?: string;
  authType?: string;
  disabled?: boolean;
};

const AUTH_TYPE_LABELS: Record<string, string> = {
  OAUTH1: 'OAuth',
  OAUTH2: 'OAuth',
  OAUTH2_CC: 'OAuth',
  MCP_OAUTH2: 'OAuth',
  MCP_OAUTH2_GENERIC: 'OAuth',
  API_KEY: 'API Key',
  BASIC: 'Basic Auth',
  APP: 'App',
  TBA: 'Token',
  JWT: 'JWT',
  TWO_STEP: 'Two-Step',
  SIGNATURE: 'Signature',
  AWS_SIGV4: 'AWS SigV4',
  CUSTOM: 'Custom',
  INSTALL_PLUGIN: 'Plugin',
  NONE: 'No Auth',
};

function authTypeLabel(authType: string) {
  return AUTH_TYPE_LABELS[authType.toUpperCase()] ?? authType;
}

function isMcpAuthType(authType: string | undefined) {
  return authType?.toUpperCase().startsWith('MCP') ?? false;
}

export type IntegrationDialogProps = Omit<DialogNewProps, 'variant' | 'children'> & {
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
  return `${item.name} ${item.id}`.toLowerCase().includes(query);
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
    <DialogNew {...props}>
      {children}
      <DialogNew.Content className={cn('max-w-lg', className)} initialFocus={searchRef}>
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
      </DialogNew.Content>
    </DialogNew>
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
      <DialogNew.Header>
        <DialogNew.Title>{title}</DialogNew.Title>
        {description ? <DialogNew.Description>{description}</DialogNew.Description> : null}
      </DialogNew.Header>
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
      <DialogNew.Body className="pt-2 pb-5">
        {visibleItems.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {visibleItems.map(item => {
              const parsedName = parseIntegrationName(item.name);
              const isMcp = isMcpAuthType(item.authType);
              const parsed = {
                name: parsedName.name,
                badge: item.badge ?? (isMcp ? 'MCP' : parsedName.badge),
              };
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
                      {parsed.name}
                    </span>
                    {parsed.badge ? <Badge size="sm">{parsed.badge}</Badge> : null}
                    {item.authType ? (
                      <span className="text-ui-sm leading-ui-sm text-neutral3 ml-auto shrink-0">
                        {authTypeLabel(item.authType)}
                      </span>
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
      </DialogNew.Body>
    </>
  );
}

IntegrationDialog.Trigger = DialogNew.Trigger;

export { IntegrationDialog };
