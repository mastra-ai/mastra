'use client';

import { Badge, Button, Link } from '@nextui-org/react';

import { default as Image } from 'next/image';

type IntegrationToggleProps = {
  name: string;
  logoUrl: string;
  connectUrl: string;
  connected: boolean;
};

export const IntegrationToggle = (props: IntegrationToggleProps) => {
  return (
    <Badge key={props.name} color={props.connected ? 'success' : 'danger'} content={' '} size={'sm'}>
      <Button isIconOnly as={Link} variant={'faded'} aria-label="integration-name" href={props.connectUrl}>
        <Image src={props.logoUrl} alt={''} width={48} height={48} />
      </Button>
    </Badge>
  );
};
