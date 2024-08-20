import { NextUIProvider } from '@nextui-org/react';

import { Integrations } from '@/app/components/Integrations';

export default function Home() {
  return (
    <main className={'h-full'}>
      <NextUIProvider>
        <div className={'flex justify-center p-4'}>
          <Integrations />
        </div>
      </NextUIProvider>
    </main>
  );
}
