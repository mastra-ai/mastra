'use client';

import { useConnection } from '@/lib/hooks/use-connection';

export const XConnector: React.FC = () => {
  const { oAuthConnectionRoute, connection } = useConnection({ name: 'X', referenceId: 'user-1' });

  return connection?.id ? (
    <p>X (formerly twitter) account connected</p>
  ) : (
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
