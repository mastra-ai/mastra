'use client';

import { Badge, Button } from '@nextui-org/react';

import { default as Image } from 'next/image';

type IntegrationToggleProps = {
  name: string;
  logoUrl: string;
  connectionId: string;
  connectUrl: string;
};

export const IntegrationToggle = (props: IntegrationToggleProps) => {
  const onConnect = () => {
    const connectUrl = new URL(props.connectUrl, window.location.href);
    const connectParams = new URLSearchParams({
      name: props.name,
      connectionId: props.connectionId,
    });

    connectUrl.search = connectParams.toString();

    window.location.replace(connectUrl.toString());
  };

  return (
    <Badge key={props.name} color={'danger'} content={' '} size={'sm'}>
      <Button isIconOnly variant={'faded'} aria-label="integration-name" onClick={onConnect}>
        <Image src={props.logoUrl} alt={''} width={48} height={48} />
      </Button>
    </Badge>
  );
};
