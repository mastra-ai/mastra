'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { ReactNode } from 'react';

const ProgressBarProvider = ({ children }: { children: ReactNode }) => {
  return (
    <>
      <ProgressBar height="4px" color="#a5a5f1" options={{ showSpinner: false }} shallowRouting />
      {children}
    </>
  );
};

export default ProgressBarProvider;
