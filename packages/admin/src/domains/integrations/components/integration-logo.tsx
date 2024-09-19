import Image from 'next/image';

import { cn } from '@/lib/utils';

export const IntegrationLogo = ({
  name,
  logoUrl,
  className,
  imageSize = 20,
  withConnectionsDot,
}: {
  name: string;
  logoUrl: string;
  className?: HTMLDivElement['className'];
  imageSize?: number;
  withConnectionsDot?: boolean;
}) => {
  const lowercasedName = name?.toLowerCase();
  const iconNoBorder = ['system', 'mailchimp'].includes(lowercasedName);
  const iconBlackBackground = ['x', 'zendesk'].includes(lowercasedName);
  const backgroundSize = imageSize * 1.6;
  const dotSize = imageSize / 2.5 + 2;
  const imgSize = iconNoBorder ? backgroundSize : imageSize;
  return (
    <div
      className={cn('flex items-center justify-center rounded bg-kpl-el-6 relative', className, {
        'bg-transparent': iconNoBorder,
        'bg-[#000]': iconBlackBackground,
      })}
      style={{
        width: backgroundSize,
        height: backgroundSize,
      }}
    >
      <Image src={logoUrl} alt={`${name} logo`} width={imgSize} height={imgSize} />
      {!!withConnectionsDot && (
        <div
          className={cn('bg-kpl-bg-connected border-2 border-kpl-bg-2 rounded-full absolute bottom-[1px]')}
          style={{
            width: dotSize,
            height: dotSize,
            right: `-${dotSize / 2}px`,
          }}
        />
      )}
    </div>
  );
};
