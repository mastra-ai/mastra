import { Button } from '@nextui-org/react';

import Image from 'next/image';

import arkw from '@/arkw.config';

export const Integrations = () => {
  return (
    <div className="flex gap-4 items-center">
      {arkw.integrations.map(integration => (
        <Button key={integration.name} isIconOnly variant={'faded'} aria-label="integration-name">
          <Image src={integration.logoUrl} alt={''} width={48} height={48} />
        </Button>
      ))}
    </div>
  );
};
