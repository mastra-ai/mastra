import { NextUIProvider } from '@nextui-org/react';

import { Contacts } from '@/app/components/Contacts';
import { Integrations } from '@/app/components/Integrations';

// import arkwConfig from '@/arkw.config';

export default async function Home() {
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
