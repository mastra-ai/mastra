import { createContext, useContext } from 'react';
import type { ThreadBackgroundWork } from './thread-background-work';

/** Undefined outside a chat that tracks its background work, such as a read-only transcript. */
export const ChatBackgroundWorkContext = createContext<ThreadBackgroundWork | undefined>(undefined);

/** The chat's background work, read once per message change by `BackgroundWorkProvider`. */
export const useChatBackgroundWork = (): ThreadBackgroundWork | undefined => useContext(ChatBackgroundWorkContext);
