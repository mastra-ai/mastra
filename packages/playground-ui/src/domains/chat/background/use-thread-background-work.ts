import { createContext, useContext } from 'react';
import { EMPTY_BACKGROUND_WORK } from './thread-background-work';
import type { ThreadBackgroundWork } from './thread-background-work';

export const BackgroundWorkContext = createContext<ThreadBackgroundWork>(EMPTY_BACKGROUND_WORK);

/** The chat's background work, read once per message change by `BackgroundWorkProvider`. */
export const useThreadBackgroundWork = (): ThreadBackgroundWork => useContext(BackgroundWorkContext);
