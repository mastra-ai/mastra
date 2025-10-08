'use client';

import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';
import { PanelRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type MainSidebarBottomProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarBottom({ children, className }: MainSidebarBottomProps) {
  return <div className={cn('mt-auto', className)}>{children}</div>;
}
