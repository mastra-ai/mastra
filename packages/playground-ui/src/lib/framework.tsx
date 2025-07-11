import { AnchorHTMLAttributes, createContext, useContext } from 'react';

export type LinkComponent = (props: AnchorHTMLAttributes<HTMLAnchorElement>) => React.ReactNode;

const LinkComponentContext = createContext<{
  Link: LinkComponent;
}>({
  Link: () => null,
});

export interface LinkComponentProviderProps {
  children: React.ReactNode;
  Link: LinkComponent;
}

export const LinkComponentProvider = ({ children, Link }: LinkComponentProviderProps) => {
  return <LinkComponentContext.Provider value={{ Link }}>{children}</LinkComponentContext.Provider>;
};

export const useLinkComponent = () => {
  return useContext(LinkComponentContext);
};
