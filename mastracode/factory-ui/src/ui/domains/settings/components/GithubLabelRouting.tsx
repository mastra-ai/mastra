import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeLabelRoutesQuery, useSaveIntakeLabelRouteMutation } from '../../../../hooks/useIntakeConfig';

const NO_BOARD = '__no_board__';

/**
 * GitHub label routing for one Factory. Issues carrying a routed label file
 * onto that board; everything else stays on Work. Only custom boards are
 * offered — Work is the default and Review takes pull requests.
 */
export function GithubLabelRouting({
  factoryProjectId,
  name,
  repositories,
}: {
  factoryProjectId: string;
  name: string;
  repositories: string[];
}) {
  const routesQuery = useIntakeLabelRoutesQuery(factoryProjectId);
  const catalog = useBoardCatalog(factoryProjectId);
  const save = useSaveIntakeLabelRouteMutation();
  const [draft, setDraft] = useState('');
  const [draftBoard, setDraftBoard] = useState<string | null>(null);

  const routes = (routesQuery.data ?? []).filter(route => route.integrationId === 'github');
  const boards = (catalog.data ?? []).filter(board => board.id !== 'work' && board.id !== 'review');
  const busy = save.isPending;
  // Routes are per Factory and apply to every repository linked to it.
  const scope = `Applies to issues from ${repositories.join(', ')}`;

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
        variant="factory"
        label={name}
        description={`${scope}. GitHub label routes are unavailable right now.`}
      />
    );
  }
  // A failed catalog is not an empty one: existing routes stay listed (and
  // removable) so a transient error never reads as "nothing is installed".
  if (boards.length === 0 && catalog.isSuccess && routes.length === 0) {
    return (
      <SettingsRow
        variant="factory"
        label={name}
        description={`${scope}. No custom boards are installed, so every issue files onto Work.`}
      />
    );
  }

  const trimmed = draft.trim();
  const duplicate = routes.some(existing => existing.label === trimmed.toLowerCase());

  return (
    <div className="flex flex-col">
      <SettingsRow
        variant="factory"
        label={name}
        description={catalog.isError ? `${scope}. Installed boards are unavailable right now.` : scope}
      />
      {routes.map(existing => {
        const current = boards.find(board => board.id === existing.board);
        return (
          <SettingsRow
            variant="factory"
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
                size="xs"
                variant="ghost"
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
      <SettingsRow
        variant="factory"
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
      </SettingsRow>
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
      <SelectTrigger variant="outline" size="sm" aria-label={ariaLabel} className="w-auto">
        <Txt as="span" variant="ui-sm">
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
