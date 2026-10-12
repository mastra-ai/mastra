import { createContext } from 'react';

/** Advanced view: each assistant message shows the spans of the run that produced it. */
export const MessageTracesContext = createContext(false);
