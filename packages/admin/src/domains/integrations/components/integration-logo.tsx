import { ReactNode } from 'react';

import Image from 'next/image';

import { lowerCaseWord } from '@/lib/string';
import { cn } from '@/lib/utils';

export const IntegrationLogo = ({
  name,
  logoUrl,
  children,
  className,
  imageSize = 20,
}: {
  name: string;
  logoUrl: string;
  children?: ReactNode;
  className?: HTMLDivElement['className'];
  imageSize?: number;
}) => {
  const lowercasedName = lowerCaseWord(name);

  const iconNoBorder = ['x', 'system'];
  return (
    <div
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded bg-kpl-bg-4',
        iconNoBorder.includes(lowercasedName) ? 'bg-transparent' : 'bg-kpl-el-6 ',
        className,
      )}
    >
      <Image src={logoUrl} alt={`${name} logo`} width={imageSize} height={imageSize} />
      {children}
    </div>
  );
};
