import {
  Badge,
  Button,
  Checkbox,
  Entity,
  EntityContent,
  EntityDescription,
  EntityName,
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Section,
  SubSectionRoot,
  Txt,
  stringToColor,
} from '@mastra/playground-ui';
import { Plug, PlusIcon, XIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';

import { useAllProviderTools } from '../hooks/use-all-provider-tools';
import { useToolProviders } from '../hooks/use-tool-providers';
import { ConnectionPicker } from './connection-picker';
import type { PickerConnection } from './connection-picker';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import type { ToolProvidersFormValue } from '@/domains/tool-providers/schemas';

/**
 * Inline CMS section that lets editors pick `ToolProvider` tools and
 * manage their connections. Reads/writes `toolProviders` on whatever
 * react-hook-form context wraps the page. Mirrors the legacy
 * `IntegrationToolsSection` in shape but speaks the new shared-connection API.
 *
 * The picker mounts with all three scopes available by default. Editors must
 * explicitly pick a Visibility before they can create a new connection —
 * there is no implicit default. Hosts that want to restrict scopes (e.g. the
 * builder hiding `caller-supplied`) can narrow `allowedScopes`.
 */
type FormShape = { toolProviders?: ToolProvidersFormValue };

interface ToolProvidersSectionProps {
  /**
   * The host's react-hook-form instance. Passed explicitly because the CMS
   * editor does not wrap its tree in RHF's `<FormProvider>` — it uses a
   * dedicated context to share the form instance. Typed loosely so hosts
   * with richer form shapes (the CMS agent edit form) can pass their form
   * without a cast — we only read/write `toolProviders`.
   */

  form: UseFormReturn<any>;
  readOnly?: boolean;
  /**
   * Scopes the host wants surfaced in the Visibility toggle. Defaults to all
   * three for the CMS surface; pass a narrower list to hide options (e.g.
   * `['per-author', 'shared']` in the builder).
   */
  allowedScopes?: readonly ('shared' | 'per-author' | 'caller-supplied')[];
}

const DEFAULT_ALLOWED_SCOPES = ['per-author', 'shared', 'caller-supplied'] as const;

export function ToolProvidersSection({
  form,
  readOnly = false,
  allowedScopes = DEFAULT_ALLOWED_SCOPES,
}: ToolProvidersSectionProps) {
  const { setValue, getValues, control } = form;
  const toolProviders = useWatch<FormShape, 'toolProviders'>({ control, name: 'toolProviders' });

  const integrationsQuery = useToolProviders();
  const integrations = useMemo(() => integrationsQuery.data?.providers ?? [], [integrationsQuery.data?.providers]);
  const { tools: allIntegrationTools, isLoading: toolsLoading } = useAllProviderTools();

  const integrationMetaById = useMemo(() => {
    const map = new Map<
      string,
      { displayName: string; multipleConnectionsPerToolkit: boolean; supportsRevoke: boolean }
    >();
    for (const integration of integrations) {
      map.set(integration.id, {
        displayName: integration.displayName ?? integration.id,
        multipleConnectionsPerToolkit: integration.capabilities?.multipleConnectionsPerToolkit ?? false,
        supportsRevoke: integration.capabilities?.supportsRevoke ?? false,
      });
    }
    return map;
  }, [integrations]);

  const selectedSlugs = useMemo(() => {
    const set = new Set<string>();
    if (!toolProviders) return set;
    for (const config of Object.values(toolProviders)) {
      for (const slug of Object.keys(config.tools ?? {})) {
        set.add(slug);
      }
    }
    return set;
  }, [toolProviders]);

  const groupedSelected = useMemo(() => {
    type Group = {
      providerId: string;
      integrationDisplayName: string;
      toolkit: string;
      multipleAllowed: boolean;
      supportsRevoke: boolean;
      connections: PickerConnection[];
      tools: { slug: string; description?: string }[];
    };
    const out: Group[] = [];
    if (!toolProviders) return out;

    for (const [providerId, config] of Object.entries(toolProviders)) {
      const meta = integrationMetaById.get(providerId);
      const services = new Set<string>([
        ...Object.keys(config.connections ?? {}),
        ...Object.values(config.tools ?? {}).map(entry => entry.toolkit),
      ]);
      for (const toolkit of services) {
        const connections = (config.connections?.[toolkit] ?? []).map(
          (connection): PickerConnection => ({
            connectionId: connection.connectionId,
            toolkit: connection.toolkit,
            label: connection.label,
            scope: connection.scope,
          }),
        );
        const tools = Object.entries(config.tools ?? {})
          .filter(([, entry]) => entry.toolkit === toolkit)
          .map(([slug, entry]) => ({ slug, description: entry.description }));
        out.push({
          providerId: providerId,
          integrationDisplayName: meta?.displayName ?? providerId,
          toolkit,
          multipleAllowed: meta?.multipleConnectionsPerToolkit ?? false,
          supportsRevoke: meta?.supportsRevoke ?? false,
          connections,
          tools,
        });
      }
    }
    return out.sort((a, b) =>
      a.integrationDisplayName === b.integrationDisplayName
        ? a.toolkit.localeCompare(b.toolkit)
        : a.integrationDisplayName.localeCompare(b.integrationDisplayName),
    );
  }, [toolProviders, integrationMetaById]);

  const handleAddTool = useCallback(
    (entry: { providerId: string; slug: string; toolkit: string; description?: string }) => {
      const current = (getValues('toolProviders') as ToolProvidersFormValue | undefined) ?? {};
      const existing = current[entry.providerId] ?? { tools: {}, connections: {} };
      const next: ToolProvidersFormValue = {
        ...current,
        [entry.providerId]: {
          tools: {
            ...(existing.tools ?? {}),
            [entry.slug]: {
              toolkit: entry.toolkit,
              ...(entry.description ? { description: entry.description } : {}),
            },
          },
          connections: existing.connections ?? {},
        },
      };
      setValue('toolProviders', next, { shouldDirty: true, shouldValidate: true });
    },
    [getValues, setValue],
  );

  const handleRemoveTool = useCallback(
    (providerId: string, slug: string) => {
      const current = (getValues('toolProviders') as ToolProvidersFormValue | undefined) ?? {};
      const existing = current[providerId];
      if (!existing) return;
      const tools = { ...(existing.tools ?? {}) };
      delete tools[slug];

      const next: ToolProvidersFormValue = { ...current };
      if (Object.keys(tools).length === 0 && Object.keys(existing.connections ?? {}).length === 0) {
        delete next[providerId];
      } else {
        next[providerId] = { tools, connections: existing.connections ?? {} };
      }
      setValue('toolProviders', next, { shouldDirty: true, shouldValidate: true });
    },
    [getValues, setValue],
  );

  const handleConnectionsChange = useCallback(
    (providerId: string, toolkit: string, nextConnections: PickerConnection[]) => {
      const current = (getValues('toolProviders') as ToolProvidersFormValue | undefined) ?? {};
      const existing = current[providerId] ?? { tools: {}, connections: {} };
      const nextConnectionsByService = {
        ...(existing.connections ?? {}),
        [toolkit]: nextConnections.map(connection => ({
          kind: 'author' as const,
          toolkit: connection.toolkit,
          connectionId: connection.connectionId,
          label: connection.label,
          scope: connection.scope,
        })),
      };
      const next: ToolProvidersFormValue = {
        ...current,
        [providerId]: { tools: existing.tools ?? {}, connections: nextConnectionsByService },
      };
      setValue('toolProviders', next, { shouldDirty: true, shouldValidate: true });
    },
    [getValues, setValue],
  );

  const addableTools = useMemo(
    () => allIntegrationTools.filter(tool => !selectedSlugs.has(tool.slug)),
    [allIntegrationTools, selectedSlugs],
  );

  if (integrationsQuery.isLoading || integrations.length === 0) {
    return null;
  }

  return (
    <SubSectionRoot data-testid="tool-integrations-section">
      <Section.Header>
        <SubSectionHeader title="Tool Integrations" icon={<Plug />} />
        {!readOnly && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" disabled={toolsLoading} data-testid="tool-integrations-add-button">
                <Icon size="sm">
                  <PlusIcon />
                </Icon>
                Add Tools
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0 max-h-80 overflow-y-auto">
              {addableTools.length === 0 ? (
                <Txt variant="ui-sm" className="px-3 py-3 text-neutral3">
                  {toolsLoading ? 'Loading…' : 'No tools available.'}
                </Txt>
              ) : (
                addableTools.map(tool => (
                  <button
                    key={`${tool.providerId}:${tool.slug}`}
                    type="button"
                    onClick={() =>
                      handleAddTool({
                        providerId: tool.providerId,
                        slug: tool.slug,
                        toolkit: tool.toolkit,
                        description: tool.description,
                      })
                    }
                    className="flex flex-col gap-0.5 w-full text-left px-3 py-2.5 hover:bg-white/10 focus:bg-white/10 transition-colors focus-visible:outline-hidden"
                    data-testid={`tool-integrations-add-tool-${tool.slug}`}
                  >
                    <span className="text-ui-md text-neutral5">{tool.name ?? tool.slug}</span>
                    <span className="text-ui-xs text-neutral3">
                      {tool.providerId} · {tool.toolkit}
                    </span>
                  </button>
                ))
              )}
            </PopoverContent>
          </Popover>
        )}
      </Section.Header>

      {groupedSelected.length === 0 ? (
        <Txt variant="ui-sm" className="text-neutral3 py-2">
          No integration tools selected.
        </Txt>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedSelected.map(group => {
            const bg = stringToColor(group.integrationDisplayName);
            const text = stringToColor(group.integrationDisplayName, 25);
            return (
              <Entity
                key={`${group.providerId}:${group.toolkit}`}
                className="flex-col items-stretch bg-surface2 gap-4 p-4"
                data-testid={`tool-integrations-group-${group.providerId}-${group.toolkit}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-9 rounded-md flex items-center justify-center uppercase shrink-0"
                    style={{ backgroundColor: bg, color: text }}
                  >
                    {group.integrationDisplayName[0]}
                  </div>
                  <EntityContent>
                    <EntityName>{group.integrationDisplayName}</EntityName>
                    <EntityDescription>{group.toolkit}</EntityDescription>
                  </EntityContent>
                  <Badge variant="default">
                    {group.tools.length} {group.tools.length === 1 ? 'tool' : 'tools'}
                  </Badge>
                </div>

                <div className="flex flex-col gap-1">
                  {group.tools.map(tool => (
                    <div
                      key={tool.slug}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-surface3"
                      data-testid={`tool-integrations-tool-${tool.slug}`}
                    >
                      <Checkbox checked disabled />
                      <span className="text-ui-sm text-neutral5 flex-1 truncate">{tool.slug}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTool(group.providerId, tool.slug)}
                          className="text-neutral3 hover:text-neutral5 transition-colors"
                          aria-label={`Remove ${tool.slug}`}
                        >
                          <Icon size="sm">
                            <XIcon />
                          </Icon>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <ConnectionPicker
                  providerId={group.providerId}
                  toolkit={group.toolkit}
                  multipleAllowed={group.multipleAllowed}
                  supportsRevoke={group.supportsRevoke}
                  connections={group.connections}
                  disabled={readOnly}
                  allowedScopes={allowedScopes}
                  onChange={next => handleConnectionsChange(group.providerId, group.toolkit, next)}
                />
              </Entity>
            );
          })}
        </div>
      )}
    </SubSectionRoot>
  );
}
