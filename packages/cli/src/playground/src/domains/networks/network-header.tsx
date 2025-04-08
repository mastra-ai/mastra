import { NavLink } from 'react-router';

import { Button, Header, Breadcrumb, Crumb, HeaderGroup } from '@mastra/playground-ui';

export function NetworkHeader({ networkName, networkId }: { networkName: string; networkId: string }) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={NavLink} href={`/networks`}>
          Networks
        </Crumb>
        <Crumb as={NavLink} href={`/networks/${networkId}`} isCurrent>
          {networkName}
        </Crumb>
      </Breadcrumb>
      <HeaderGroup>
        <Button as={NavLink} href={`/networks/${networkId}/chat`}>
          Chat
        </Button>
      </HeaderGroup>
    </Header>
  );
}
