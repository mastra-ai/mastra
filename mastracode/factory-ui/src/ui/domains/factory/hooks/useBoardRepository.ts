import { useFactoryQuery } from '../../../../hooks/useFactories';

export function useBoardRepository(factoryId: string | undefined): string | undefined {
  const repositories = useFactoryQuery(factoryId).data?.repositories ?? [];
  return repositories.length === 1 ? repositories[0].slug : undefined;
}
