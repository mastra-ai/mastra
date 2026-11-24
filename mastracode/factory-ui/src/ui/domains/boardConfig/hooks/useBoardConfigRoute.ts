import { useLocation } from 'react-router';

import { parseBoardConfigPath } from '../boardConfigPaths';
import type { BoardConfigLocation } from '../boardConfigPaths';

/** The board configuration open at the current location, if any. */
export function useBoardConfigRoute(): BoardConfigLocation | undefined {
  return parseBoardConfigPath(useLocation().pathname);
}
