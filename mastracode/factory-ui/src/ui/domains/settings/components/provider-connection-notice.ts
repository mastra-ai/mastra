import { createContext } from 'react';

/** Optional environment guidance, e.g. a sandbox that cannot accept real credentials. */
export const ProviderConnectionNoticeContext = createContext<string | undefined>(undefined);
