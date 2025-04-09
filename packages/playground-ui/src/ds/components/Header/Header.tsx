import React from 'react';

import { Txt } from '../Txt';

export interface HeaderProps {
  children?: React.ReactNode;
}

export const Header = ({ children }: HeaderProps) => {
  return (
    <header className="h-header-default bg-surface2 border-b-sm border-border1 z-50 flex w-full items-center gap-[18px] px-5">
      {children}
    </header>
  );
};

export const HeaderTitle = ({ children }: HeaderProps) => {
  return (
    <Txt as="h1" variant="ui-lg" className="font-medium text-white">
      {children}
    </Txt>
  );
};

export const HeaderAction = ({ children }: HeaderProps) => {
  return <div className="ml-auto">{children}</div>;
};

export const HeaderGroup = ({ children }: HeaderProps) => {
  return <div className="gap-lg flex items-center">{children}</div>;
};
