import { createContext, useContext } from 'react';

const OpenToolContext = createContext<string | undefined>(undefined);

/** Provided by ToolDrawer for the tool in `?tool=`, so the body doesn't need it passed down. */
export const OpenToolProvider = OpenToolContext.Provider;

/** The id of the tool open in the drawer. Only valid inside ToolDrawer's body. */
export function useOpenToolId(): string {
  const toolId = useContext(OpenToolContext);
  if (toolId === undefined) throw new Error('useOpenToolId must be used inside ToolDrawer');
  return toolId;
}
