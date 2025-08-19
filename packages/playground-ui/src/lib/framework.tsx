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
  navigate: (path: string) => void;
}>({
  Link: forwardRef<HTMLAnchorElement, LinkComponentProps>(() => null),
  navigate: () => {},
});

export interface LinkComponentProviderProps {
  children: React.ReactNode;
  Link: LinkComponent;
  navigate: (path: string) => void;
}

export const LinkComponentProvider = ({ children, Link, navigate }: LinkComponentProviderProps) => {
  return <LinkComponentContext.Provider value={{ Link, navigate }}>{children}</LinkComponentContext.Provider>;
};

export const useLinkComponent = () => {
  const ctx = useContext(LinkComponentContext);

  if (!ctx) {
    throw new Error('useLinkComponent must be used within a LinkComponentProvider');
  }

  return ctx;
};
