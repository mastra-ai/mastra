import { Integration } from '@arkw/core';
import { NextUIProvider } from '@nextui-org/react';

import { Integrations } from '@/app/components/Integrations';
import arkw from '@/arkw.config';

export default function Home() {
  const integrations = arkw.integrations;

  return (
    <main className={'h-full'}>
      <NextUIProvider>
        <div className={'flex justify-center p-4'}>
          <Integrations available={integrations} connected={[]} />
        </div>
      </NextUIProvider>
    </main>
  );
}
