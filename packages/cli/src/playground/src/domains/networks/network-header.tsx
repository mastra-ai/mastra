import { Link, NavLink } from 'react-router';

import { Button, Header, Breadcrumb, Crumb, HeaderGroup } from '@mastra/playground-ui';

export function NetworkHeader({ networkName, networkId }: { networkName: string; networkId: string }) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/networks`}>
          Networks
        </Crumb>
        <Crumb as={Link} to={`/networks/${networkId}`} isCurrent>
          {networkName}
        </Crumb>
      </Breadcrumb>

      <HeaderGroup>
        <Button as={Link} to={`/networks/${networkId}/chat`}>
          Chat
        </Button>
      </HeaderGroup>
    </Header>
  );
}
