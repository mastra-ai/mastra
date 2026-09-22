import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import type { ReactNode } from 'react';

export type LoginLayoutProps = {
  title: string;
  description?: ReactNode;
  errorBanner?: ReactNode;
  children: ReactNode;
};

/**
 * Shared form shell for `/login` and `/signup`.
 *
 * Owns the logo, heading, and spacing so both routes render identically.
 * The viewport and centering are provided by `AuthLayout`.
 */
export function LoginLayout({ title, description, errorBanner, children }: LoginLayoutProps) {
  return (
    <div data-testid="login-page" className="w-full max-w-sm space-y-6 p-6">
      <div className="flex flex-col items-center space-y-2">
        <LogoWithoutText className="h-10 w-10" />
        <h1 className="text-foreground text-heading">{title}</h1>
      </div>

      {description}

      {errorBanner}

      {children}
    </div>
  );
}
