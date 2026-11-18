import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import { FactoryHalftoneField } from './FactoryHalftoneField';

export const SIGN_IN_HEADER_CLASS = 'mb-6';
export const SIGN_IN_DESCRIPTION_CLASS = 'mt-2';
export const SIGN_IN_FORM_CLASS = 'w-full gap-5';
export const SIGN_IN_FORM_TOGGLE_CLASS = 'self-center';
export const HOSTED_SIGN_IN_BUTTON_CLASS = 'w-80 max-w-full';

export function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-foreground min-h-dvh">
      <div className="mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 px-6 sm:px-10 lg:grid-cols-[minmax(380px,0.82fr)_minmax(540px,1.18fr)]">
        <section className="relative z-3 flex max-w-xl flex-col justify-center py-11 lg:py-17">
          <Txt as="h1" variant="hero" className="max-w-xl text-balance">
            Build with an agent factory
          </Txt>
          <Txt as="p" variant="lead" tone="muted" className="mt-6 max-w-lg">
            Turn a repository into a working factory. Agents pick up scoped work, collaborate, and ship changes you can
            review.
          </Txt>

          <section aria-label="Authentication" className="mt-10 w-full max-w-md lg:mt-12">
            {children}
          </section>
        </section>

        <FactoryHalftoneField />
      </div>
    </main>
  );
}
