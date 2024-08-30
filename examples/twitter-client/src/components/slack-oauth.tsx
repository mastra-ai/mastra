'use client';

import { useConnection } from '@/lib/hooks/use-connection';

import { SendSlackMessage } from './send-slack-message';
import { Skeleton } from './ui/skeleton';

export const SlackConnector: React.FC = () => {
  const { oAuthConnectionRoute, connection, isLoading, error, executeAPI } = useConnection({ name: 'SLACK' });

  if (isLoading) {
    return <Skeleton className="h-4 w-72" />;
  }

  if (error) {
    return <p className="text-red-500 text-xs">{(error as { message: string })?.message}</p>;
  }

  if (connection?.id) {
    return (
      <div className="space-y-4">
        <p>Slack account connected</p>

        <SendSlackMessage
          sendMessage={payload => {
            return executeAPI({ payload, apiType: 'SEND_MESSAGE_TO_CHANNEL' });
          }}
        />
      </div>
    );
  }

  return (
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
