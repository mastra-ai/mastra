import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import type { ReactNode } from 'react';

export type LoginLayoutProps = {
  title: string;
  description?: ReactNode;
  errorBanner?: ReactNode;
  children: ReactNode;
};

/**
 * Shared visual shell for `/login` and `/signup`.
 *
 * Owns the centered viewport, logo, heading, and spacing so both routes
 * render an identical, borderless layout. Variable content is provided
 * through slot props.
 */
export function LoginLayout({ title, description, errorBanner, children }: LoginLayoutProps) {
  return (
    <div data-testid="login-page" className="bg-surface1 flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <LogoWithoutText className="h-10 w-10" />
          <h1 className="text-neutral6 text-xl font-semibold">{title}</h1>
        </div>

        {description}

        {errorBanner}

        {children}
      </div>
    </div>
  );
}
