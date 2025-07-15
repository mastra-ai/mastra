import {
  AnchorHTMLAttributes,
  createContext,
  forwardRef,
  ForwardRefExoticComponent,
  RefAttributes,
  useContext,
} from 'react';

// Define the props type for your Link component
export type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement>;

// Define the actual component type with ref attributes
export type LinkComponent = ForwardRefExoticComponent<LinkComponentProps & RefAttributes<HTMLAnchorElement>>;

const LinkComponentContext = createContext<{
  Link: LinkComponent;
}>({
  Link: forwardRef<HTMLAnchorElement, LinkComponentProps>(() => null),
});

export interface LinkComponentProviderProps {
  children: React.ReactNode;
  Link: LinkComponent;
}

export const LinkComponentProvider = ({ children, Link }: LinkComponentProviderProps) => {
  return <LinkComponentContext.Provider value={{ Link }}>{children}</LinkComponentContext.Provider>;
};

export const useLinkComponent = () => {
  const ctx = useContext(LinkComponentContext);

  if (!ctx) {
    throw new Error('useLinkComponent must be used within a LinkComponentProvider');
  }

  return ctx;
};
