import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsFieldsetRow, SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeLabelRoutesQuery, useSaveIntakeLabelRouteMutation } from '../../../../hooks/useIntakeConfig';
import { SkeletonRows } from '../../../ui/SkeletonRows';

const NO_BOARD = '__no_board__';

export function GithubLabelRouting({
  factoryProjectId,
  name,
  repositories,
  showScope = true,
}: {
  factoryProjectId: string;
  name: string;
  repositories: string[];
  showScope?: boolean;
}) {
  const routesQuery = useIntakeLabelRoutesQuery(factoryProjectId);
  const catalog = useBoardCatalog(factoryProjectId);
  const save = useSaveIntakeLabelRouteMutation();
  const [draft, setDraft] = useState('');
  const [draftBoard, setDraftBoard] = useState<string | null>(null);

  const routes = (routesQuery.data ?? []).filter(route => route.integrationId === 'github');
  const boards = (catalog.data ?? []).filter(board => board.id !== 'work' && board.id !== 'review');
  const busy = save.isPending;

  const scope = showScope ? `Applies to issues from ${repositories.join(', ')}` : undefined;
  const label = (
    <span className="flex flex-wrap items-center gap-2">
      <span>Routing</span>
      {showScope && (
        <Txt as="span" variant="caption" tone="muted">
          {name}
        </Txt>
      )}
    </span>
  );
  const summary = <Txt variant="body-sm">{routes.length ? 'Unmatched issues' : 'Issues'} → Work · PRs → Review</Txt>;

  const route = (label: string, board: string | null, onDone?: () => void) => {
    save.mutate(
      { factoryProjectId, integrationId: 'github', label, board },
      {
        onSuccess: () => {
          toast.success('GitHub routing updated');
          onDone?.();
        },
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save GitHub routing'),
      },
    );
  };

  if (routesQuery.isError) {
    return (
      <SettingsRow
        label={label}
        description={[scope, 'GitHub label routes are unavailable right now.'].filter(Boolean).join('. ')}
      />
    );
  }

  if (routesQuery.isPending || catalog.isPending) {
    return (
      <SettingsRow label={label} description={scope}>
        <SkeletonRows label={`Loading ${name} routing`} rows={1} />
      </SettingsRow>
    );
  }

  if (boards.length === 0 && catalog.isSuccess && routesQuery.isSuccess && routes.length === 0) {
    return (
      <SettingsFieldsetRow label={label} description={scope} className="sm:items-start">
        <div className="flex w-full flex-col gap-1 sm:w-3/4">
          {summary}
          <Txt variant="caption" tone="muted">
            No custom boards in {name}.
          </Txt>
        </div>
      </SettingsFieldsetRow>
    );
  }

  const trimmed = draft.trim();
  const duplicate = routes.some(existing => existing.label === trimmed.toLowerCase());

  return (
    <div className="flex flex-col">
      <SettingsRow
        label={label}
        description={
          catalog.isError ? [scope, 'Installed boards are unavailable right now.'].filter(Boolean).join('. ') : scope
        }
      >
        {summary}
      </SettingsRow>
      {routes.map(existing => {
        const current = boards.find(board => board.id === existing.board);
        return (
          <SettingsRow
            key={existing.label}
            label={existing.label}
            description={
              current || catalog.isError
                ? undefined
                : `Board '${existing.board}' is not installed; issues stay on Work.`
            }
          >
            <div className="flex items-center gap-2">
              <BoardSelect
                ariaLabel={`Board for ${existing.label}`}
                value={current?.id ?? null}
                placeholder={
                  current || catalog.isError ? (current?.title ?? existing.board) : `${existing.board} (not installed)`
                }
                boards={boards}
                disabled={busy || !catalog.isSuccess}
                onChange={next => route(existing.label, next)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 />}
                aria-label={`Remove route for ${existing.label}`}
                disabled={busy}
                onClick={() => route(existing.label, null)}
              >
                Remove
              </Button>
            </div>
          </SettingsRow>
        );
      })}
      <SettingsFieldsetRow
        label="Add label route"
        description={duplicate ? 'That label is already routed — change its board above.' : undefined}
      >
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            aria-label={`Label for ${name}`}
            placeholder="label"
            value={draft}
            disabled={busy}
            onChange={event => setDraft(event.target.value)}
          />
          <BoardSelect
            ariaLabel={`Board for new ${name} label`}
            value={draftBoard}
            placeholder="Choose a board"
            boards={boards}
            disabled={busy || !catalog.isSuccess}
            onChange={setDraftBoard}
          />
          <Button
            size="sm"
            icon={<Plus />}
            disabled={busy || !trimmed || !draftBoard || duplicate}
            onClick={() =>
              route(trimmed, draftBoard, () => {
                setDraft('');
                setDraftBoard(null);
              })
            }
          >
            Add
          </Button>
        </div>
      </SettingsFieldsetRow>
    </div>
  );
}

function BoardSelect({
  ariaLabel,
  value,
  placeholder,
  boards,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  value: string | null;
  placeholder: string;
  boards: { id: string; title: string }[];
  disabled: boolean;
  onChange: (board: string | null) => void;
}) {
  const current = boards.find(board => board.id === value);
  return (
    <Select
      value={current?.id ?? NO_BOARD}
      disabled={disabled}
      onValueChange={next => onChange(next === NO_BOARD ? null : next)}
    >
      <SelectTrigger size="sm" aria-label={ariaLabel} className="w-auto">
        <Txt as="span" variant="caption">
          {current?.title ?? placeholder}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_BOARD}>No board</SelectItem>
        {boards.map(board => (
          <SelectItem key={board.id} value={board.id}>
            {board.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
