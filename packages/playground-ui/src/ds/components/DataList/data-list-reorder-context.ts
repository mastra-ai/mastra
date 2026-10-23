import { createContext, useContext } from 'react';

export type DataListReorderContextValue = {
  reorderable: boolean;
  /** `order[visualPosition] = originalColumnIndex`. */
  order: number[];
  /** Moves the column at visual position `from` to visual position `to`. */
  move: (from: number, to: number) => void;
};

export const DataListReorderContext = createContext<DataListReorderContextValue>({
  reorderable: false,
  order: [],
  move: () => {},
});

export const useDataListReorder = () => useContext(DataListReorderContext);
