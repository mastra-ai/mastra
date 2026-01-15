import { useMastraPlatform } from '../hooks/use-mastra-platform';

export interface HideInPlatformProps {
  children: React.ReactNode;
}

export const HideInPlatform = ({ children }: HideInPlatformProps) => {
  const { isMastraPlatform } = useMastraPlatform();

  if (isMastraPlatform) {
    return null;
  }

  return <>{children}</>;
};
