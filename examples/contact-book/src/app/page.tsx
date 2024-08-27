import { NextUIProvider, Button } from '@nextui-org/react';

import { getSession } from '@/app/actions/session';
import { Contacts } from '@/app/components/Contacts';
import { Integrations } from '@/app/components/Integrations';
import { SignIn } from '@/app/components/SignIn';

export default async function Home() {
  const session = await getSession();

  return (
    <main className={'h-full'}>
      <NextUIProvider>
        {!session ? (
          <SignIn />
        ) : (
          <div className={'flex flex-col items-center p-4'}>
            {/*@ts-ignore*/}
            <Integrations />
            <div>
              {/*@ts-ignore*/}
              <Contacts />
            </div>
          </div>
        )}
      </NextUIProvider>
    </main>
  );
}
