import type {
  BoardCatalogResponse,
  CreateBoardBody,
  FactoryRequestError,
  IntakeDryRunBody,
  IntakeDryRunResponse,
  IntakeNotRoutedResponse,
  IntakeOrderResponse,
  IntakeRerouteApplyResponse,
  IntakeRerouteResponse,
  IntakeRouteAgainResponse,
  IntakeRouteInfo,
  IntakeRouteInput,
  IntakeRoutePatch,
  IntakeSkippedResponse,
  IntakeTestBody,
  IntakeTestResponse,
  StoredBoardResponse,
} from '@mastra/client-js';
import { skipToken, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, UseInfiniteQueryResult, UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { useFactory } from './context';
import { factoryKeys } from './keys';

const NOT_ROUTED_PAGE = 20;

/** Reset a built-in or app board to its code definition; refused with `revision_mismatch` when someone saved it first. */
export function useResetBoardMutation(
  factoryProjectId: string | undefined,
  boardKey: string,
): UseMutationResult<StoredBoardResponse, FactoryRequestError, number> {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation<StoredBoardResponse, FactoryRequestError, number>({
    mutationKey: factoryKeys.boardWrite(factoryProjectId, boardKey),
    mutationFn: expectedRevision => factory!.resetBoard(boardKey, expectedRevision),
    onSuccess: async response => {
      queryClient.setQueryData(factoryKeys.board(factoryProjectId, boardKey), response);
      await queryClient.invalidateQueries({ queryKey: factoryKeys.boardCatalog(factoryProjectId), exact: true });
    },
  });
}

/**
 * Create a board of the project's own. Refused with a 409 when the key is taken: `code_board` for a key
 * Factory keeps, and `board_exists` for one the project already uses.
 */
export function useCreateBoardMutation(
  factoryProjectId: string | undefined,
): UseMutationResult<StoredBoardResponse, FactoryRequestError, CreateBoardBody> {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation<StoredBoardResponse, FactoryRequestError, CreateBoardBody>({
    mutationFn: body => factory!.createBoard(body),
    onSuccess: async response => {
      queryClient.setQueryData(factoryKeys.board(factoryProjectId, response.board.key), response);
      await queryClient.invalidateQueries({ queryKey: factoryKeys.boardCatalog(factoryProjectId), exact: true });
    },
  });
}

/**
 * Delete a board no card sits on; refused with `revision_mismatch` when someone changed it since
 * `expectedRevision`. `onDeleted` runs before the board leaves the cache, so the caller can leave
 * the board while whatever shows it is still mounted.
 */
export function useDeleteBoardMutation(
  factoryProjectId: string | undefined,
  boardKey: string,
  onDeleted: () => void,
): UseMutationResult<void, FactoryRequestError, number> {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation<void, FactoryRequestError, number>({
    mutationKey: factoryKeys.boardWrite(factoryProjectId, boardKey),
    mutationFn: expectedRevision => factory!.deleteBoard(boardKey, expectedRevision),
    onSuccess: async () => {
      // The list still names the board until it is read again, and what shows next is picked from it.
      queryClient.setQueryData<BoardCatalogResponse>(
        factoryKeys.boardCatalog(factoryProjectId),
        catalog => catalog && { ...catalog, boards: catalog.boards.filter(board => board.id !== boardKey) },
      );
      onDeleted();
      queryClient.removeQueries({ queryKey: factoryKeys.board(factoryProjectId, boardKey), exact: true });
      await queryClient.invalidateQueries({ queryKey: factoryKeys.boardCatalog(factoryProjectId), exact: true });
    },
  });
}

export type RouteWrite =
  | { kind: 'create'; route: IntakeRouteInput }
  | { kind: 'update'; id: string; patch: IntakeRoutePatch }
  | { kind: 'delete'; id: string; expectedRevision: number }
  /** With `boardKey`, `ids` name every rule of that board and only they trade places. */
  | { kind: 'reorder'; ids: string[]; boardKey?: string };

/**
 * Changes the project's intake routes, one request after another, then reloads them. A change
 * someone else made first refuses with `revision_mismatch` (or, for a reorder, `intake_route_set_mismatch`).
 */
export function useIntakeRouteWrites(
  factoryProjectId: string | undefined,
): UseMutationResult<IntakeRouteInfo[], FactoryRequestError, RouteWrite[]> {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation<IntakeRouteInfo[], FactoryRequestError, RouteWrite[]>({
    mutationFn: async writes => {
      const created: IntakeRouteInfo[] = [];
      for (const write of writes) {
        if (write.kind === 'create') created.push((await factory!.createIntakeRoute(write.route)).intakeRoute);
        else if (write.kind === 'update') await factory!.updateIntakeRoute(write.id, write.patch);
        else if (write.kind === 'delete') await factory!.deleteIntakeRoute(write.id, write.expectedRevision);
        else
          await factory!.reorderIntakeRoutes(
            write.boardKey === undefined ? { ids: write.ids } : { ids: write.ids, boardKey: write.boardKey },
          );
      }
      return created;
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: factoryKeys.intakeRoutes(factoryProjectId) }),
        // The intake order lists each board's rule count.
        queryClient.invalidateQueries({ queryKey: factoryKeys.intakeOrder(factoryProjectId) }),
      ]),
  });
}

/** Untouched cards the current rules would now file on a different board. */
export function useReroutePreview(
  factoryProjectId: string | undefined,
): UseQueryResult<IntakeRerouteResponse, FactoryRequestError> {
  const factory = useFactory(factoryProjectId);
  return useQuery<IntakeRerouteResponse, FactoryRequestError>({
    queryKey: factoryKeys.intakeReroute(factoryProjectId),
    queryFn: factory ? ({ signal }) => factory.reroutePreview({ signal }) : skipToken,
  });
}

/** Moves the untouched cards `useReroutePreview` lists to the start of the board they now belong on. */
export function useApplyReroute(
  factoryProjectId: string | undefined,
): UseMutationResult<IntakeRerouteApplyResponse, FactoryRequestError, void> {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation<IntakeRerouteApplyResponse, FactoryRequestError, void>({
    mutationFn: () => factory!.applyReroute(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: factoryKeys.intakeReroute(factoryProjectId) }),
  });
}

/** The order intake asks the project's boards to take a new item. */
export function useIntakeOrderQuery(
  factoryProjectId: string | undefined,
): UseQueryResult<IntakeOrderResponse, FactoryRequestError> {
  const factory = useFactory(factoryProjectId);
  return useQuery<IntakeOrderResponse, FactoryRequestError>({
    queryKey: factoryKeys.intakeOrder(factoryProjectId),
    queryFn: factory ? ({ signal }) => factory.intakeOrder({ signal }) : skipToken,
  });
}

/** Sets the intake order: every board of the project, once each. */
export function useSaveIntakeOrder(
  factoryProjectId: string | undefined,
): UseMutationResult<IntakeOrderResponse, FactoryRequestError, string[]> {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation<IntakeOrderResponse, FactoryRequestError, string[]>({
    mutationFn: boardKeys => factory!.setIntakeOrder({ boardKeys }),
    onSuccess: order => queryClient.setQueryData(factoryKeys.intakeOrder(factoryProjectId), order),
  });
}

/** Items no board's intake rules took, a page at a time. */
export function useNotRoutedQuery(
  factoryProjectId: string | undefined,
): UseInfiniteQueryResult<InfiniteData<IntakeNotRoutedResponse, string | undefined>, FactoryRequestError> {
  const factory = useFactory(factoryProjectId);
  return useInfiniteQuery<
    IntakeNotRoutedResponse,
    FactoryRequestError,
    InfiniteData<IntakeNotRoutedResponse, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: factoryKeys.intakeNotRouted(factoryProjectId),
    queryFn: factory
      ? ({ pageParam, signal }) => factory.notRouted({ limit: NOT_ROUTED_PAGE, cursor: pageParam }, { signal })
      : skipToken,
    initialPageParam: undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
}

/** Runs intake again for a Not routed item; it is filed once the dispatcher picks it up. */
export function useRouteAgain(
  factoryProjectId: string | undefined,
): UseMutationResult<IntakeRouteAgainResponse, FactoryRequestError, string> {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation<IntakeRouteAgainResponse, FactoryRequestError, string>({
    mutationFn: decisionId => factory!.routeAgain(decisionId),
    // The item stays Not routed on the server until the dispatcher files it, so a refetch now would bring it back:
    // take it off the list instead. A failure refetches, keeping whatever is still Not routed.
    onSuccess: (_, decisionId) =>
      queryClient.setQueryData<InfiniteData<IntakeNotRoutedResponse>>(
        factoryKeys.intakeNotRouted(factoryProjectId),
        data =>
          data && {
            ...data,
            pages: data.pages.map(page => ({
              ...page,
              notRouted: page.notRouted.filter(item => item.id !== decisionId),
            })),
          },
      ),
    onError: () => queryClient.invalidateQueries({ queryKey: factoryKeys.intakeNotRouted(factoryProjectId) }),
  });
}

/** How often each card-move rule was skipped in the last 30 days, because its target couldn't take the card. */
export function useSkippedRulesQuery(
  factoryProjectId: string | undefined,
): UseQueryResult<IntakeSkippedResponse, FactoryRequestError> {
  const factory = useFactory(factoryProjectId);
  return useQuery<IntakeSkippedResponse, FactoryRequestError>({
    queryKey: factoryKeys.intakeSkipped(factoryProjectId),
    queryFn: factory ? ({ signal }) => factory.skipped({ signal }) : skipToken,
  });
}

/** What to test: a pasted issue or pull request URL, or a card's or Not routed decision's id. */
export function intakeTestBody(subject: string): { url: string } | { itemId: string } {
  return subject.startsWith('http') ? { url: subject } : { itemId: subject };
}

/** The saved intake rules run over the project's newest items. Nothing is filed. */
export function useIntakeDryRunQuery(
  factoryProjectId: string | undefined,
): UseQueryResult<IntakeDryRunResponse, FactoryRequestError> {
  const factory = useFactory(factoryProjectId);
  return useQuery<IntakeDryRunResponse, FactoryRequestError>({
    queryKey: factoryKeys.intakeDryRun(factoryProjectId),
    queryFn: factory ? ({ signal }) => factory.intakeDryRun({}, { signal }) : skipToken,
  });
}

/** Runs unsaved rules or an unsaved intake order over the same items, against the saved ones. Admins only. */
export function useIntakeDryRunPreview(
  factoryProjectId: string | undefined,
): UseMutationResult<IntakeDryRunResponse, FactoryRequestError, IntakeDryRunBody> {
  const factory = useFactory(factoryProjectId);
  return useMutation<IntakeDryRunResponse, FactoryRequestError, IntakeDryRunBody>({
    mutationFn: body => factory!.intakeDryRun(body),
  });
}

/** "Where would this go?" for one item against the saved rules; a blank subject tests nothing. */
export function useIntakeTestQuery(
  factoryProjectId: string | undefined,
  subject: string | undefined,
): UseQueryResult<IntakeTestResponse, FactoryRequestError> {
  const factory = useFactory(factoryProjectId);
  const trimmed = subject?.trim() || undefined;
  return useQuery<IntakeTestResponse, FactoryRequestError>({
    queryKey: factoryKeys.intakeTest(factoryProjectId, trimmed ?? ''),
    queryFn: factory && trimmed ? ({ signal }) => factory.intakeTest(intakeTestBody(trimmed), { signal }) : skipToken,
  });
}

/** "Where would this go?": one item by URL or id, with what every rule answered. Nothing is filed. */
export function useIntakeTest(
  factoryProjectId: string | undefined,
): UseMutationResult<IntakeTestResponse, FactoryRequestError, IntakeTestBody> {
  const factory = useFactory(factoryProjectId);
  return useMutation<IntakeTestResponse, FactoryRequestError, IntakeTestBody>({
    mutationFn: body => factory!.intakeTest(body),
  });
}
