import { ReactNode } from 'react';

import Image from 'next/image';

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

  return (
    <div
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded bg-kpl-bg-4/60',
        className,
      )}
    >
      <Image src={logoUrl} alt={`${name} logo`} width={imageSize} height={imageSize} />
      {children}
    </div>
  );
};
