'use client';

import { useConnection } from '@/lib/hooks/use-connection';

export const SlackConnector: React.FC = () => {
  const { oAuthConnectionRoute, connection } = useConnection({ name: 'SLACK', referenceId: 'user-1' });

  return connection?.id ? (
    <p>Slack account connected</p>
  ) : (
    <div className="flex gap-4 items-center">
      <p>Connect your Slack account</p>
      <a
        href={oAuthConnectionRoute}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
      >
        Connect with Slack
      </a>
    </div>
  );
};
