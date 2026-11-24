import { createContext } from 'react';

/** Off when the interface can't act: a read-only transcript, or a reply still streaming. */
export const GenUiInteractiveContext = createContext(false);
