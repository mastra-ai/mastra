import { createContext, useContext } from 'react';

export type ContentBlocksContextType = {
  items: Array<string>;
  onChange: (items: Array<string>) => void;
};

export const ContentBlocksContext = createContext<ContentBlocksContextType>({
  items: [],
  onChange: () => {},
});

export type ContextBlockContextType = {
  item: string;
  modifyAtIndex: (item: string) => void;
};

export const ContentBlockContext = createContext<ContextBlockContextType>({
  item: '',
  modifyAtIndex: () => {},
});

export const useContentBlock = () => {
  const { item, modifyAtIndex } = useContext(ContentBlockContext);

  return [item, modifyAtIndex] as const;
};
