import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { WEB_HOST } from './host';
import type { MastraCodeHost } from './host';

const MastraCodeHostContext = createContext<MastraCodeHost>(WEB_HOST);

export function MastraCodeHostProvider({ host, children }: { host: MastraCodeHost; children: ReactNode }) {
  return <MastraCodeHostContext value={host}>{children}</MastraCodeHostContext>;
}

export function useMastraCodeHost(): MastraCodeHost {
  return useContext(MastraCodeHostContext);
}
