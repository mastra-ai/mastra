'use client';

import { Button } from '@nextui-org/react';

import { setSession } from '@/app/actions/session';

export const SignIn = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Button variant={'solid'} onClick={() => setSession()}>
        Sign-In
      </Button>
    </div>
  );
};
