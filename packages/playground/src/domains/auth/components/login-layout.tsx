import { LogoWithoutText } from '@mastra/playground-ui';
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
    <div data-testid="login-page" className="flex min-h-screen items-center justify-center bg-surface1">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-2">
          <LogoWithoutText className="h-10 w-10" />
          <h1 className="text-xl font-semibold text-neutral6">{title}</h1>
        </div>

        {description}

        {errorBanner}

        {children}
      </div>
    </div>
  );
}
