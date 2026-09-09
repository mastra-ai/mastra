import { createContext } from 'react';
import type { ReactNode } from 'react';

export type TabMeasurement = {
  value: string;
  label: ReactNode;
  disabled: boolean;
  width: number;
  element: HTMLElement;
  onClick?: () => void;
};

export const TabsContext = createContext<{
  appearance: 'default' | 'contained';
  frame: 'stroke' | 'inset';
  value: string;
  select(value: string): void;
} | null>(null);

export const TabListContext = createContext<{
  hiddenValues: ReadonlySet<string>;
  register(tab: TabMeasurement): void;
  unregister(value: string): void;
} | null>(null);
