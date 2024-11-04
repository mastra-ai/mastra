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
  const iconNoBorder = [
    'attio',
    'apollo',
    'system',
    'mailchimp',
    'ashby',
    'brex',
    'coda',
    'discord',
    'dropbox',
    'instagram',
    'jira',
    'lever',
    'quickbooks',
    'ragie',
    'resend',
    'slack',
    'twilio',
    'sendgrid',
    'zoom',
    'figma',
    'github',
    'stripe',
  ].includes(lowercasedName);
  const iconBlackBackground = ['x'].includes(lowercasedName);
  const backgroundSize = imageSize * 1.6;
  const dotSize = imageSize / 2.5 + 2;
  const imgSize = iconNoBorder ? backgroundSize : imageSize;
  return (
    <div
      className={cn('shrink-0 flex items-center justify-center rounded bg-mastra-el-6 relative', className, {
        'bg-transparent': iconNoBorder,
        'bg-[#000]': iconBlackBackground,
      })}
      style={{
        width: backgroundSize,
        height: backgroundSize,
      }}
    >
      <Image
        src={logoUrl ?? `/images/integrations/fallback.svg`}
        alt={`${name} logo`}
        className={cn({ 'rounded aspect-square': iconNoBorder })}
        width={imgSize}
        height={imgSize}
      />
      {!!withConnectionsDot && (
        <div
          className={cn('bg-mastra-bg-connected border-2 border-mastra-bg-2 rounded-full absolute bottom-[1px]')}
          style={{
            width: dotSize,
            height: dotSize,
            right: `-${dotSize / 5}px`,
          }}
        />
      )}
    </div>
  );
};
