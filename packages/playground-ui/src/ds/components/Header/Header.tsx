import clsx from 'clsx';
import React from 'react';

import { Txt } from '../Txt';

export interface HeaderProps {
  children?: React.ReactNode;
  border?: boolean;
  className?: string;
}

export const Header = ({ children, border = true, className }: HeaderProps) => {
  return (
    <header
      className={clsx(
        'h-header-default z-50 flex w-full items-center gap-[18px] bg-transparent px-5',
        border && {
          'border-b-sm border-border1': border,
        },
        className,
      )}
    >
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
