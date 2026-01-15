import React from 'react';

import { Txt } from '../Txt';
import { cn } from '@/lib/utils';

export interface HeaderProps {
  children?: React.ReactNode;
  border?: boolean;
}

export const Header = ({ children, border = true }: HeaderProps) => {
  return (
    <header
      className={cn('h-header-default z-50 flex w-full items-center gap-[18px] bg-transparent px-3', {
        'border-b border-border1': border,
      })}
    >
      {children}
    </header>
  );
};

export const HeaderTitle = ({ children }: HeaderProps) => {
  return (
    <Txt as="h1" variant="ui-md" className="text-white flex items-center gap-2">
      {children}
    </Txt>
  );
};

export const HeaderAction = ({ children }: HeaderProps) => {
  return <div className="ml-auto flex items-center gap-3">{children}</div>;
};

export const HeaderGroup = ({ children }: HeaderProps) => {
  return <div className="gap-lg flex items-center">{children}</div>;
};
