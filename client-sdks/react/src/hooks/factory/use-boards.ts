import type {
  BoardCatalogResponse,
  Factory,
  FactoryRequestError,
  InstalledBoardInfo,
  IntakeRouteListResponse,
  ReplaceBoardBody,
  StoredBoardResponse,
} from '@mastra/client-js';
import { skipToken, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryKey, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

import { useFactory } from './context';
import { factoryKeys } from './keys';

/** The read behind `useBoardCatalog`, also used to load the catalog ahead of a page. */
export function boardCatalogQueryOptions(
  factory: Factory | undefined,
): UseQueryOptions<BoardCatalogResponse, Error, BoardCatalogResponse, QueryKey> {
  return {
    queryKey: factoryKeys.boardCatalog(factory?.factoryProjectId),
    queryFn: factory ? ({ signal }) => factory.boardCatalog({ signal }) : skipToken,
  };
}

/** The project's boards, each with its phases and the phase that plays each part of the pull request loop. */
export function useBoardCatalog(factoryProjectId: string | undefined): UseQueryResult<InstalledBoardInfo[]> {
  const factory = useFactory(factoryProjectId);
  return useQuery({ ...boardCatalogQueryOptions(factory), select: data => data.boards });
}

/** The read behind `useBoardQuery`, also used to load a board ahead of a page. */
export function storedBoardQueryOptions(
  factory: Factory | undefined,
  boardKey: string,
): UseQueryOptions<StoredBoardResponse, FactoryRequestError, StoredBoardResponse, QueryKey> {
  return {
    queryKey: factoryKeys.board(factory?.factoryProjectId, boardKey),
    queryFn: factory ? ({ signal }) => factory.board(boardKey, { signal }) : skipToken,
  };
}

/** One board as stored, with its revision and whether the caller may edit it. */
export function useBoardQuery(
  factoryProjectId: string | undefined,
  boardKey: string,
): UseQueryResult<StoredBoardResponse, FactoryRequestError> {
  return useQuery(storedBoardQueryOptions(useFactory(factoryProjectId), boardKey));
}

/** Whether a save, reset or delete of the board is on its way, wherever on the page it was started. */
export function useBoardWritePending(factoryProjectId: string | undefined, boardKey: string): boolean {
  return useIsMutating({ mutationKey: factoryKeys.boardWrite(factoryProjectId, boardKey) }) > 0;
}

/** Save an edited board; refused with `revision_mismatch` when someone changed it since `expectedRevision`. */
export function useSaveBoardMutation(
  factoryProjectId: string | undefined,
  boardKey: string,
): UseMutationResult<StoredBoardResponse, FactoryRequestError, ReplaceBoardBody> {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation<StoredBoardResponse, FactoryRequestError, ReplaceBoardBody>({
    mutationKey: factoryKeys.boardWrite(factoryProjectId, boardKey),
    mutationFn: body => factory!.replaceBoard(boardKey, body),
    onSuccess: async response => {
      queryClient.setQueryData(factoryKeys.board(factoryProjectId, boardKey), response);
      // The catalog serves the edited board to the rest of the app.
      await queryClient.invalidateQueries({ queryKey: factoryKeys.boardCatalog(factoryProjectId), exact: true });
    },
  });
}

/** The read behind `useIntakeRoutesQuery`, also used to load the routes ahead of a page. */
export function intakeRoutesQueryOptions(
  factory: Factory | undefined,
): UseQueryOptions<IntakeRouteListResponse, FactoryRequestError, IntakeRouteListResponse, QueryKey> {
  return {
    queryKey: factoryKeys.intakeRoutes(factory?.factoryProjectId),
    queryFn: factory ? ({ signal }) => factory.intakeRoutes({ signal }) : skipToken,
  };
}

/** The project's intake routes: which issues and pull requests land on which board. */
export function useIntakeRoutesQuery(
  factoryProjectId: string | undefined,
): UseQueryResult<IntakeRouteListResponse, FactoryRequestError> {
  return useQuery(intakeRoutesQueryOptions(useFactory(factoryProjectId)));
}

/**
 * Whether the caller may create, edit and delete this project's boards (an organization admin).
 * Read off the intake routes, which answer for the project whatever boards it has. The server enforces it on every write.
 */
export function useCanEditBoards(factoryProjectId: string | undefined): boolean {
  return useIntakeRoutesQuery(factoryProjectId).data?.canEdit ?? false;
}
