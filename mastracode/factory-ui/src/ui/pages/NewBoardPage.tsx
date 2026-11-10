import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useApiConfig } from '../../api/config';
import { useBoardCatalog } from '../../hooks/useBoardCatalog';
import { storedBoardQueryOptions, useCreateBoardMutation } from '../../hooks/useBoardEditor';
import { useIntakeRoutesQuery } from '../../hooks/useIntakeRoutes';
import { boardConfigPath } from '../domains/boardConfig/boardConfigPaths';
import { draftOf, keyFromName, keyProblem, starterBoard } from '../domains/boardConfig/boardDraft';
import type { BoardDraft } from '../domains/boardConfig/boardDraft';
import { IntakeNote } from '../domains/boardConfig/components/IntakeNote';
import { orderedBoards } from '../domains/factory/boardCatalog';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

const STARTER = '__starter__';

/**
 * Factory › New board: its name, key and the phases it starts with. Its phases are edited in its settings,
 * which open once it exists.
 */
export function NewBoardPage() {
  const factory = useActiveFactory();
  // Whether this person may create boards is known once the intake routes load.
  const access = useIntakeRoutesQuery(factory.id);
  const catalog = useBoardCatalog(factory.id);
  const boards = orderedBoards(catalog.data ?? []);
  const [name, setName] = useState('');
  const [typedKey, setTypedKey] = useState<string>();
  const [source, setSource] = useState(STARTER);
  const [phases, setPhases] = useState<Pick<BoardDraft, 'description' | 'phases'>>(starterBoard);
  const [copyError, setCopyError] = useState<string>();
  const [copying, setCopying] = useState(false);
  const create = useCreateBoardMutation(factory.id);
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const id = useId();

  // The key follows the name until it is typed by hand.
  const key = typedKey ?? keyFromName(name);
  const untouched = typedKey === undefined && name.trim() === '';
  // A create the server answers with a conflict is about the key, whatever holds it: shown on the key field.
  const refusedKey = create.error?.status === 409 ? create.error.message : undefined;
  const invalidKey = untouched
    ? undefined
    : keyProblem(
        key,
        boards.map(board => board.id),
      );
  const keyError = invalidKey ?? refusedKey;
  const pending = create.isPending || copying;
  const sourceName = (value: string) => boards.find(board => board.id === value)?.title ?? 'Backlog, Doing, Done';

  const startFrom = async (value: string) => {
    setSource(value);
    setCopyError(undefined);
    create.reset();
    if (value === STARTER) {
      setPhases(starterBoard());
      return;
    }
    setCopying(true);
    try {
      const { board } = await queryClient.fetchQuery(storedBoardQueryOptions(baseUrl, factory.id, value));
      setPhases(draftOf(board));
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : 'The board could not be read.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <PageLayout
      variant="narrow"
      header={
        <div className="mx-auto w-full max-w-2xl pb-8">
          <PageHeader>
            <PageHeader.Title>New board</PageHeader.Title>
          </PageHeader>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {access.isPending ? null : !access.data?.canEdit ? (
          <Notice variant="info">Only organization admins can create boards.</Notice>
        ) : (
          <form
            className="flex flex-col gap-6"
            aria-label="New board"
            onSubmit={event => {
              event.preventDefault();
              create.mutate(
                { ...phases, key, name: name.trim() },
                { onSuccess: ({ board }) => void navigate(boardConfigPath(factory.id, board.key)) },
              );
            }}
          >
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Board name</FieldLabel>
              <Input
                id={`${id}-name`}
                value={name}
                disabled={pending}
                onChange={event => {
                  create.reset();
                  setName(event.target.value);
                }}
              />
            </Field>
            <Field invalid={keyError !== undefined}>
              <FieldLabel htmlFor={`${id}-key`}>Board key</FieldLabel>
              <Input
                id={`${id}-key`}
                value={key}
                disabled={pending}
                onChange={event => {
                  create.reset();
                  setTypedKey(event.target.value);
                }}
              />
              {keyError ? (
                <FieldError>{keyError}</FieldError>
              ) : (
                <FieldDescription>Names the board in links and the API. Cannot be changed later.</FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-source`}>Start from</FieldLabel>
              <Select value={source} disabled={pending} onValueChange={value => void startFrom(String(value))}>
                <SelectTrigger id={`${id}-source`} size="sm" aria-label="Start from">
                  {sourceName(source)}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STARTER}>{sourceName(STARTER)}</SelectItem>
                  {boards.map(board => (
                    <SelectItem key={board.id} value={board.id}>
                      Copy of {board.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>The phases the board starts with. Change them once it's created.</FieldDescription>
            </Field>
            {copyError && (
              <Notice variant="destructive" role="alert" title="The board was not copied">
                {copyError}
              </Notice>
            )}
            <IntakeNote factoryId={factory.id} />
            {create.error && !refusedKey && (
              <Notice variant="destructive" role="alert" title="The board was not created">
                <span className="whitespace-pre-wrap">
                  {create.error.conflicts.length > 0 ? create.error.conflicts.join('\n') : create.error.message}
                </span>
              </Notice>
            )}
            <div className="flex justify-end gap-2">
              <Button render={<Link to={`/factories/${factory.id}`} />} disabled={create.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={pending || name.trim() === '' || invalidKey !== undefined}
              >
                {create.isPending ? 'Creating…' : 'Create board'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageLayout>
  );
}
