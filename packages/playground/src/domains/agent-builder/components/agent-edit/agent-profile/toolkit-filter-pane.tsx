import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@mastra/playground-ui/components/InputGroup';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { SearchIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useToolkits } from '../../../../tool-providers/hooks/use-toolkits';
import { useAgentColor } from '../../../contexts/agent-color-context';
import { ToolkitConnectionControl } from './toolkit-connection-control';
import type { ProviderSection, ToolkitOption } from './use-provider-toolkit-groups';

const TEST_ID_PREFIX = 'tools-toolkit';

interface ToolkitRow {
  id: string;
  label: string;
  /** Backend-provided toolkit icon (typically a URL/data-URI). Absent for Built-in. */
  icon?: string;
}

interface ToolkitFilterRowProps {
  item: ToolkitRow;
  checked: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
  /** Set for provider toolkit rows; absent for the Built-in group. */
  providerId?: string;
  multipleAllowed?: boolean;
}

const ToolkitFilterRow = memo(
  ({ item, checked, disabled, onToggle, providerId, multipleAllowed }: ToolkitFilterRowProps) => {
    const agentColor = useAgentColor();
    const checkboxStyle = checked
      ? {
          backgroundColor: agentColor.background,
          borderColor: agentColor.background,
          color: agentColor.foreground,
        }
      : undefined;

    return (
      <li className="flex items-center gap-1">
        <label
          data-testid={`${TEST_ID_PREFIX}-filter-item-${item.id}`}
          data-checked={checked ? 'true' : 'false'}
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-ui-sm text-neutral6 transition-colors hover:bg-surface4',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={() => onToggle(item.id)}
            style={checkboxStyle}
            data-testid={`${TEST_ID_PREFIX}-filter-checkbox-${item.id}`}
            className="h-3.5 w-3.5 shrink-0 shadow-none data-[state=checked]:shadow-none [&_svg]:h-2.5 [&_svg]:w-2.5"
          />
          {item.icon && (
            <img
              src={item.icon}
              alt=""
              aria-hidden
              data-testid={`${TEST_ID_PREFIX}-filter-icon-${item.id}`}
              className="h-4 w-4 shrink-0 rounded object-contain"
            />
          )}
          <span className="truncate">{item.label}</span>
        </label>
        {providerId && (
          <div className="shrink-0">
            <ToolkitConnectionControl
              providerId={providerId}
              toolkit={item.id}
              disabled={disabled}
              multipleAllowed={multipleAllowed}
            />
          </div>
        )}
      </li>
    );
  },
);

ToolkitFilterRow.displayName = 'ToolkitFilterRow';

interface ProviderToolkitSectionProps {
  provider: ProviderSection;
  term: string;
  isChecked: (id: string) => boolean;
  onToggle: (id: string) => void;
  disabled: boolean;
  multipleAllowed: boolean;
}

/**
 * Renders a single provider's toolkit checkboxes. Owns its own toolkit fetch
 * (`useToolkits`) so the pane never has to coordinate N async loads: while this
 * provider's toolkits load it shows a skeleton, and only renders real rows once
 * they resolve. Toolkit display names therefore appear correctly cased on first
 * paint — there's no slug→name swap. Search is a plain synchronous filter over
 * the resolved rows, so it simply has nothing to act on until the data is in.
 */
const ProviderToolkitSection = ({
  provider,
  term,
  isChecked,
  onToggle,
  disabled,
  multipleAllowed,
}: ProviderToolkitSectionProps) => {
  const { data, isLoading } = useToolkits(provider.providerId);

  const toolkits = useMemo<ToolkitRow[]>(() => {
    const names = new Map<string, string>();
    const icons = new Map<string, string>();
    for (const toolkit of data?.data ?? []) {
      names.set(toolkit.slug, toolkit.name ?? toolkit.slug);
      if (toolkit.icon) icons.set(toolkit.slug, toolkit.icon);
    }
    const rows: ToolkitRow[] = provider.presentSlugs
      .map(slug => ({ id: slug, label: names.get(slug) ?? slug, icon: icons.get(slug) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (!term) return rows;
    return rows.filter(t => t.label.toLowerCase().includes(term));
  }, [data, provider.presentSlugs, term]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 px-2">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: Math.min(provider.presentSlugs.length, 3) }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (toolkits.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <Txt
        variant="ui-xs"
        data-testid={`tools-provider-section-${provider.providerId}`}
        className="text-neutral3 px-2 pt-1 tracking-wide uppercase"
      >
        {provider.providerName}
      </Txt>
      <ul className="flex flex-col gap-0.5">
        {toolkits.map(item => (
          <ToolkitFilterRow
            key={item.id}
            item={item}
            checked={isChecked(item.id)}
            disabled={disabled}
            onToggle={onToggle}
            providerId={provider.providerId}
            multipleAllowed={multipleAllowed}
          />
        ))}
      </ul>
    </div>
  );
};

interface ToolkitFilterPaneProps {
  builtIn: ToolkitOption[];
  providers: ProviderSection[];
  isProvidersLoading: boolean;
  isChecked: (id: string) => boolean;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  disabled?: boolean;
  /** Per-provider capability: whether a toolkit may hold multiple connections. */
  multipleAllowedByProvider: Map<string, boolean>;
}

/**
 * Left-pane toolkit filter, grouped by provider. A synthetic "Built-in" group
 * (for native tools/agents/workflows) renders immediately; each provider is its
 * own {@link ProviderToolkitSection} that fetches and renders independently. A
 * single search box and global Select all / Clear all act across every group.
 * Selection semantics are a flat `Set<toolkit>` owned by the parent — provider
 * grouping is presentational only.
 */
export const ToolkitFilterPane = ({
  builtIn,
  providers,
  isProvidersLoading,
  isChecked,
  onToggle,
  onSelectAll,
  onClearAll,
  disabled = false,
  multipleAllowedByProvider,
}: ToolkitFilterPaneProps) => {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();

  const filteredBuiltIn = useMemo(
    () => (term ? builtIn.filter(t => t.label.toLowerCase().includes(term)) : builtIn),
    [builtIn, term],
  );

  return (
    <div
      className="border-border1 flex h-full min-h-0 flex-col gap-3 border-r px-6 py-6"
      data-testid={`${TEST_ID_PREFIX}-filter`}
    >
      <div className="bg-surface3 shrink-0 rounded-full" data-testid={`${TEST_ID_PREFIX}-filter-search`}>
        <InputGroup variant="outline" size="lg">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Filter toolkits"
            placeholder="Filter toolkits..."
            onChange={event => setSearch(event.target.value)}
          />
        </InputGroup>
      </div>

      <div className="text-ui-xs flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={disabled}
          data-testid={`${TEST_ID_PREFIX}-filter-select-all`}
          className="text-neutral3 hover:text-neutral6 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          Select all
        </button>
        <span className="text-neutral2" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={onClearAll}
          disabled={disabled}
          data-testid={`${TEST_ID_PREFIX}-filter-clear-all`}
          className="text-neutral3 hover:text-neutral6 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear all
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1" viewPortClassName="pr-2">
        <div className="flex flex-col gap-3">
          {/* Built-in group renders immediately; it needs no async fetch. */}
          {filteredBuiltIn.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {filteredBuiltIn.map(item => (
                <ToolkitFilterRow
                  key={item.id}
                  item={item}
                  checked={isChecked(item.id)}
                  disabled={disabled}
                  onToggle={onToggle}
                />
              ))}
            </ul>
          )}

          {/* Each provider fetches and renders its own toolkits independently. */}
          {providers.map(provider => (
            <ProviderToolkitSection
              key={provider.providerId}
              provider={provider}
              term={term}
              isChecked={isChecked}
              onToggle={onToggle}
              disabled={disabled}
              multipleAllowed={multipleAllowedByProvider.get(provider.providerId) ?? false}
            />
          ))}

          {isProvidersLoading && (
            <div className="flex flex-col gap-1 px-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
