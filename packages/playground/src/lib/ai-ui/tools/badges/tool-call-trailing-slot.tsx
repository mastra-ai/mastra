import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Extra controls a parent wants rendered on the header line of the tool call
 * badge it wraps, next to the collapse trigger. Consumed by the outermost
 * `BadgeWrapper` only — it resets the slot so nested badges (an agent's inner
 * tool calls) do not repeat the controls.
 */
export const ToolCallTrailingSlotContext = createContext<ReactNode>(null);

export const useToolCallTrailingSlot = () => useContext(ToolCallTrailingSlotContext);
