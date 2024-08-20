import { Button, Badge } from '@nextui-org/react';

import Image from 'next/image';

import arkw from '@/arkw.config';

export const Integrations = () => {
  // TODO: Need a way to query for connected integrations from arkw

  return (
    <div className="flex gap-4 items-center">
      {arkw.integrations.map(integration => (
        <Badge color={'danger'} content={' '} size={'sm'}>
          <Button key={integration.name} isIconOnly variant={'faded'} aria-label="integration-name">
            <Image src={integration.logoUrl} alt={''} width={48} height={48} />
          </Button>
        </Badge>
      ))}
    </div>
  );
};
