import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import {
  SettingsContainer,
  SettingsGroup,
  SettingsListHeader,
  SettingsRow,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/utils/toast';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useStudioConfig } from '../context/studio-config-state';

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

function sameConnection(a: ConnectionDraft, b: ConnectionDraft) {
  return (
    a.baseUrl.trim() === b.baseUrl.trim() &&
    a.apiPrefix.trim() === b.apiPrefix.trim() &&
    JSON.stringify(headersRecord(a.headers)) === JSON.stringify(headersRecord(b.headers))
  );
}

/**
 * Where Studio sends its requests: the instance URL, its API prefix and the headers sent with every request. They
 * only work as a set (a new instance often needs its own prefix and auth header), so edits stay a draft until
 * "Save changes" applies them together: Studio switches once, from one working connection to the next.
 */
export function StudioConnectionSettings() {
  const { baseUrl, apiPrefix, headers, setConfig } = useStudioConfig();
  // Rows keep an id so removing one doesn't hand its inputs to the next. A counter, not `crypto.randomUUID`,
  // which is missing when Studio is served over plain http.
  const nextId = useRef(0);
  const fromConfig = (): ConnectionDraft => ({
    baseUrl,
    apiPrefix: apiPrefix ?? '',
    headers: Object.entries(headers).map(([name, value]) => ({ id: nextId.current++, name, value })),
  });
  const [saved, setSaved] = useState(fromConfig);
  const [draft, setDraft] = useState(saved);
  const [urlError, setUrlError] = useState<string>();
  const changed = !sameConnection(draft, saved);

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
    setSaved(draft);
    toast.success('Connection saved');
  }

  function discard() {
    setDraft(saved);
    setUrlError(undefined);
  }

  const headerCount = draft.headers.length;

  return (
    <SettingsGroup>
      <SettingsTitle info="The Mastra instance the studio talks to, the path in front of its API routes, and the headers sent with every request.">
        Mastra connection
      </SettingsTitle>
      <form onSubmit={save} onReset={discard} noValidate>
        <SettingsContainer>
          <SettingsRow label="Mastra instance URL" description="The server this studio talks to." errorMsg={urlError}>
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
          <SettingsRow label="API prefix" description="Path in front of every API route.">
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
            {headerCount === 0
              ? 'No request headers'
              : headerCount === 1
                ? '1 request header'
                : `${headerCount} request headers`}
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
    </SettingsGroup>
  );
}
