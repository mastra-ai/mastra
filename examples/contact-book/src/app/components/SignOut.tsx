'use client';

import { Button } from '@nextui-org/react';

import { session } from '@/app/actions/session';

export const SignOut = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Button variant={'solid'} onClick={() => session()}>
        Sign-In
      </Button>
    </div>
  );
};
