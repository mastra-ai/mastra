import { Connection } from '@arkw/core';

import { framework } from '@/lib/framework-utils';

export const XConnector: React.FC<{ connection: Connection | null }> = ({ connection }) => {
  const OAuthConnectionRoute = framework?.makeConnectURI({
    clientRedirectPath: '/',
    name: 'X',
    referenceId: 'user-1',
  });

  return connection?.id ? (
    <p>X (formerly twitter) account connected</p>
  ) : (
    <div className="flex gap-4 items-center">
      <p>Connect your X (formerly twitter) account</p>
      <a
        href={OAuthConnectionRoute}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
      >
        Connect with X
      </a>
    </div>
  );
};
