import { NextUIProvider, Input } from '@nextui-org/react';

import { Contacts } from '@/app/components/Contacts';
import { Integrations } from '@/app/components/Integrations';

export default function Home() {
  return (
    <main className={'h-full'}>
      <NextUIProvider>
        <div className={'flex flex-col items-center p-4'}>
          <Integrations />
          <div>
            <Contacts />
          </div>
        </div>
      </NextUIProvider>
    </main>
  );
}
