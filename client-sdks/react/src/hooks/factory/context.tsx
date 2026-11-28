import type { Factory, FactoryWeb } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { useMastraClient } from '../../mastra-client-context';

const FactoryBasePathContext = createContext<string | undefined>(undefined);

/**
 * Where the host serves Factory's routes. Standalone Factory serves them at `/web/factory`, the
 * client's default; a host that mounts them elsewhere names its path here.
 */
export function FactoryBasePathProvider({ basePath, children }: { basePath: string; children: ReactNode }) {
  return <FactoryBasePathContext.Provider value={basePath}>{children}</FactoryBasePathContext.Provider>;
}

/** The Factory client for a project, or nothing before a project is picked. */
export function useFactory(factoryProjectId: string): Factory;
export function useFactory(factoryProjectId: string | undefined): Factory | undefined;
export function useFactory(factoryProjectId: string | undefined): Factory | undefined {
  const client = useMastraClient();
  const basePath = useContext(FactoryBasePathContext);
  return useMemo(
    () => (factoryProjectId ? client.getFactory(factoryProjectId, basePath ? { basePath } : undefined) : undefined),
    [client, factoryProjectId, basePath],
  );
}

const FactoryWebBasePathContext = createContext<string | undefined>(undefined);

/**
 * Where the host serves Factory's routes outside `/web/factory` (model config, providers, voice,
 * workspace). Standalone Factory serves them at `/web`, the client's default.
 */
export function FactoryWebBasePathProvider({ webBasePath, children }: { webBasePath: string; children: ReactNode }) {
  return <FactoryWebBasePathContext.Provider value={webBasePath}>{children}</FactoryWebBasePathContext.Provider>;
}

export function useFactoryWeb(): FactoryWeb {
  const client = useMastraClient();
  const webBasePath = useContext(FactoryWebBasePathContext);
  return useMemo(() => client.getFactoryWeb(webBasePath ? { webBasePath } : undefined), [client, webBasePath]);
}
