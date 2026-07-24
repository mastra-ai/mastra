import React from 'react';

import { Txt } from '../Txt';
import { cn } from '@/lib/utils';

export interface HeaderProps {
  children?: React.ReactNode;
  border?: boolean;
  className?: string;
}

export const Header = ({ children, border = true, className }: HeaderProps) => {
  return (
    <header
      className={cn(
        'z-50 flex h-header-default w-full items-center gap-4 bg-transparent px-3',
        {
          'border-b border-border1': border,
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
    <Txt as="h1" variant="ui-md" className="flex items-center gap-2 text-neutral6">
      {children}
    </Txt>
  );
};

export const HeaderAction = ({ children }: HeaderProps) => {
  return <div className="ml-auto flex items-center gap-3">{children}</div>;
};

export const HeaderGroup = ({ children }: HeaderProps) => {
  return <div className="flex items-center gap-2">{children}</div>;
};
