import { Connection } from '@arkw/core';

import { framework } from '@/lib/framework-utils';

export const SlackConnector: React.FC<{ connection: Connection | null }> = ({ connection }) => {
  const OAuthConnectionRoute = framework?.makeConnectURI({
    clientRedirectPath: '/',
    name: 'SLACK',
    referenceId: 'user-1',
  });

  return connection?.id ? (
    <p>Slack account connected</p>
  ) : (
    <div className="flex gap-4 items-center">
      <p>Connect your Slack account</p>
      <a
        href={OAuthConnectionRoute}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
      >
        Connect with Slack
      </a>
    </div>
  );
};
