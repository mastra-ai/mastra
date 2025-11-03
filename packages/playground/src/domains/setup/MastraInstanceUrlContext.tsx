import { createContext, useContext } from 'react';
import { useUrlState } from './useUrlState';

export const MastraInstanceUrlContext = createContext<{
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
}>({
  url: '',
  setUrl: () => {},
  isLoading: true,
});

export const MastraInstanceUrlProvider = ({ children }: { children: React.ReactNode }) => {
  const { url, setUrl, isLoading } = useUrlState();

  return (
    <MastraInstanceUrlContext.Provider value={{ url, setUrl, isLoading }}>{children}</MastraInstanceUrlContext.Provider>
  );
};

export const useMastraInstanceUrl = () => {
  return useContext(MastraInstanceUrlContext);
};
