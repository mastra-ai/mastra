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

  const lowercasedName = name.toLowerCase()
  const iconNoBorder = ['system', 'mailchimp'].includes(lowercasedName);
  const iconBlackBackground = ['x', 'zendesk'].includes(lowercasedName);
  const imgSize = iconNoBorder ? 32 : imageSize;
  return (
    <div
      className={cn('w-8 h-8 flex items-center justify-center rounded bg-kpl-el-6', className, {
        'bg-transparent': iconNoBorder,
        'bg-[#000]': iconBlackBackground,
      })}
    >
      <Image src={logoUrl} alt={`${name} logo`} width={imgSize} height={imgSize} />
      {children}
    </div>
  );
};
