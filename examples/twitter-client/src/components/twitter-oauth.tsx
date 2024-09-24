'use client';

import { useConnection } from '@/lib/hooks/use-connection';

import { CreateTweet } from './create-tweet';
import { Skeleton } from './ui/skeleton';

export const XConnector: React.FC = () => {
  const { oAuthConnectionRoute, connection, callApi, isLoading, error } = useConnection({ name: 'X' });

  if (isLoading) {
    return <Skeleton className="h-4 w-72" />;
  }

  if (error) {
    return <p className="text-red-500 text-xs">{(error as { message: string })?.message}</p>;
  }

  if (connection?.id) {
    return (
      <div className="space-y-4">
        <p>X (formerly twitter) account connected</p>

        <CreateTweet
          sendMessage={payload => {
            return callApi({ payload, apiType: 'CREATE_POST' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-4 items-center">
      <p>Connect your X (formerly twitter) account</p>
      <a
        href={oAuthConnectionRoute}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
      >
        Connect with X
      </a>
    </div>
  );
};
