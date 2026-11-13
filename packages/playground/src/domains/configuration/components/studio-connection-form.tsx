import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { SettingsContainer, SettingsListHeader, SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/utils/toast';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useStudioConfig } from '../context/studio-config-state';
import type { StudioConfig } from '../types';

interface HeaderRow {
  id: number;
  name: string;
  value: string;
}

interface ConnectionDraft {
  baseUrl: string;
  apiPrefix: string;
  headers: HeaderRow[];
}

function headersRecord(rows: HeaderRow[]) {
  return Object.fromEntries(rows.filter(row => row.name.trim()).map(row => [row.name.trim(), row.value]));
}

function matchesConfig(draft: ConnectionDraft, config: StudioConfig) {
  return (
    draft.baseUrl.trim() === config.baseUrl.trim() &&
    draft.apiPrefix.trim() === (config.apiPrefix ?? '').trim() &&
    JSON.stringify(headersRecord(draft.headers)) === JSON.stringify(config.headers)
  );
}

function headerCountLabel(count: number) {
  if (count === 0) return 'No request headers';
  if (count === 1) return '1 request header';
  return `${count} request headers`;
}

/**
 * The URL, API prefix and headers only work as a set (a new instance often needs its own prefix and auth header), so
 * edits stay a draft until "Save changes" applies them together: Studio switches once, from one working connection
 * to the next. Saving changes the stored config, which remounts the form (it's keyed by it) on the saved values.
 */
export function StudioConnectionForm({ initialConfig }: { initialConfig: StudioConfig }) {
  const { setConfig } = useStudioConfig();
  // Rows keep an id so removing one doesn't hand its inputs to the next. A counter, not `crypto.randomUUID`,
  // which is missing when Studio is served over plain http.
  const nextId = useRef(0);
  const draftFromConfig = (): ConnectionDraft => ({
    baseUrl: initialConfig.baseUrl,
    apiPrefix: initialConfig.apiPrefix ?? '',
    headers: Object.entries(initialConfig.headers).map(([name, value]) => ({ id: nextId.current++, name, value })),
  });
  const [draft, setDraft] = useState(draftFromConfig);
  const [urlError, setUrlError] = useState<string>();
  const changed = !matchesConfig(draft, initialConfig);

  const updateHeader = (id: number, patch: Partial<HeaderRow>) =>
    setDraft(current => ({
      ...current,
      headers: current.headers.map(row => (row.id === id ? { ...row, ...patch } : row)),
    }));

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.baseUrl.trim()) {
      setUrlError('Enter the server URL');
      return;
    }
    setConfig({
      baseUrl: draft.baseUrl.trim(),
      apiPrefix: draft.apiPrefix.trim() || undefined,
      headers: headersRecord(draft.headers),
    });
    toast.success('Connection saved');
  }

  function discard() {
    setDraft(draftFromConfig());
    setUrlError(undefined);
  }

  return (
    <form onSubmit={save} onReset={discard} noValidate>
      <SettingsContainer>
        <SettingsRow label="Mastra instance URL" errorMsg={urlError}>
          <Input
            name="url"
            value={draft.baseUrl}
            placeholder="http://localhost:4111"
            spellCheck={false}
            onChange={event => {
              setDraft(current => ({ ...current, baseUrl: event.target.value }));
              setUrlError(undefined);
            }}
          />
        </SettingsRow>
        <SettingsRow label="API prefix">
          <Input
            name="apiPrefix"
            value={draft.apiPrefix}
            placeholder="/api (default)"
            spellCheck={false}
            onChange={event => setDraft(current => ({ ...current, apiPrefix: event.target.value }))}
          />
        </SettingsRow>
        <SettingsListHeader
          action={
            <Button
              type="button"
              size="sm"
              icon={<PlusIcon />}
              onClick={() =>
                setDraft(current => ({
                  ...current,
                  headers: [...current.headers, { id: nextId.current++, name: '', value: '' }],
                }))
              }
            >
              Add header
            </Button>
          }
        >
          {headerCountLabel(draft.headers.length)}
        </SettingsListHeader>
        {draft.headers.map(row => (
          <div key={row.id} className="flex min-w-0 items-center gap-2">
            <Input
              aria-label="Header name"
              value={row.name}
              placeholder="Authorization"
              spellCheck={false}
              onChange={event => updateHeader(row.id, { name: event.target.value })}
            />
            <Input
              aria-label={row.name ? `Value of ${row.name}` : 'Header value'}
              value={row.value}
              placeholder="Bearer <token>"
              spellCheck={false}
              onChange={event => updateHeader(row.id, { value: event.target.value })}
            />
            <Button
              type="button"
              size="icon-md"
              variant="ghost"
              aria-label={row.name ? `Remove ${row.name}` : 'Remove header'}
              tooltip="Remove header"
              onClick={() =>
                setDraft(current => ({ ...current, headers: current.headers.filter(other => other.id !== row.id) }))
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        {changed ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-body-sm text-muted-foreground">Unsaved changes</span>
            <div className="flex items-center gap-2">
              <Button type="reset" size="sm" variant="ghost">
                Discard
              </Button>
              <Button type="submit" size="sm" variant="primary">
                Save changes
              </Button>
            </div>
          </div>
        ) : null}
      </SettingsContainer>
    </form>
  );
}
