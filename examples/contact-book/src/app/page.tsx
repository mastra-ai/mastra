import { NextUIProvider, Button } from '@nextui-org/react';

import { Contacts } from '@/components/Contacts';
import { Integrations } from '@/components/Integrations';
import { SignIn } from '@/components/SignIn';

import { getSession } from '@/app/actions/session';

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
