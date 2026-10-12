import { createContext, useContext } from 'react';

export type DataListResizeContextValue = {
  resizable: boolean;
  /** Sets the width in px of the column at its original index. */
  setWidth: (index: number, px: number) => void;
  /** Drops the stored width of the column at its original index. */
  resetWidth: (index: number) => void;
};

export const disabledResize: DataListResizeContextValue = {
  resizable: false,
  setWidth: () => {},
  resetWidth: () => {},
};

export const DataListResizeContext = createContext<DataListResizeContextValue>(disabledResize);

export const useDataListResize = () => useContext(DataListResizeContext);
