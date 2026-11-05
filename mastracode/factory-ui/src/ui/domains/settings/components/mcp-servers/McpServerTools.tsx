import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { McpServerInfo } from '../../../../../api/types';
import { useSetMcpServerTools } from '../../../../../hooks/use-mcp-servers';

/**
 * The tools a server listed, and which of them sessions get. Admins choose;
 * members see the same list read-only. Remount (via `key`) when the server's
 * catalog or selection changes so the draft starts from the saved state.
 */
export function McpServerTools({ server, canManage }: { server: McpServerInfo; canManage: boolean }) {
  const setTools = useSetMcpServerTools();
  // Tools a built-in or Factory tool's name keeps from sessions can't be chosen.
  const available = server.tools.filter(tool => !tool.unavailable);
  const [selected, setSelected] = useState(
    () => new Set(available.filter(tool => tool.selected).map(tool => tool.name)),
  );
  const changed = available.some(tool => selected.has(tool.name) !== tool.selected);
  // Saving, even unchanged, marks new tools as reviewed: the admin can keep them off.
  const reviewing = server.tools.some(tool => tool.isNew);
  const disabled = !canManage || setTools.isPending;

  const toggle = (name: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(name);
    else next.delete(name);
    setSelected(next);
  };

  if (server.tools.length === 0) {
    return (
      <Txt as="p" variant="caption" tone="muted">
        {server.discoveredAt ? 'This server has no tools.' : 'Connect the server to list its tools.'}
      </Txt>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Txt as="p" variant="caption" tone="muted" className="tabular-nums">
          {selected.size} of {server.tools.length} tools go to sessions
        </Txt>
        {canManage && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => setSelected(new Set(available.map(tool => tool.name)))}
            >
              Select all
            </Button>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>
      <ul role="list" aria-label={`${server.name} tools`} className="divide-border flex flex-col divide-y">
        {server.tools.map(tool => (
          <li key={tool.name} className="flex items-start gap-3 py-2">
            <Checkbox
              className="mt-0.5"
              checked={selected.has(tool.name)}
              aria-label={tool.title ?? tool.name}
              disabled={disabled || Boolean(tool.unavailable)}
              onCheckedChange={checked => toggle(tool.name, checked === true)}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Txt as="span" variant="body-sm" tone="ink">
                  {tool.title ?? tool.name}
                </Txt>
                {tool.isNew && (
                  <Badge size="sm" variant="info">
                    New
                  </Badge>
                )}
                {tool.unavailable && (
                  <Badge size="sm" variant="warning">
                    Not available
                  </Badge>
                )}
                {tool.annotations?.readOnlyHint === true && (
                  <Badge size="sm" variant="neutral">
                    Read-only
                  </Badge>
                )}
                {tool.annotations?.destructiveHint === true && tool.annotations.readOnlyHint !== true && (
                  <Badge size="sm" variant="warning">
                    Destructive
                  </Badge>
                )}
              </div>
              {tool.description && (
                <Txt as="p" variant="caption" tone="muted" className="line-clamp-2">
                  {tool.description}
                </Txt>
              )}
              {tool.unavailable && (
                <Txt as="p" variant="caption" tone="muted">
                  Sessions don't get this tool: a built-in or Factory tool already has its name.
                </Txt>
              )}
              <Txt as="span" variant="meta" tone="muted" font="mono" className="truncate">
                {tool.exposedName}
              </Txt>
            </div>
          </li>
        ))}
      </ul>
      {setTools.error && (
        <Txt as="p" variant="caption" role="alert" className="text-destructive-foreground">
          {setTools.error.message}
        </Txt>
      )}
      {canManage && (
        <div>
          <Button
            size="sm"
            variant="primary"
            disabled={!(changed || reviewing) || setTools.isPending}
            onClick={() => setTools.mutate({ id: server.id, selected: [...selected] })}
          >
            {setTools.isPending && <Spinner size="sm" aria-hidden className="size-3" />}
            Save selection
          </Button>
        </div>
      )}
    </div>
  );
}
