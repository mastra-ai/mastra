import Link from 'next/link';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

export const ConnectionList = ({ connections }: { connections?: Array<{ name: string }> }) => {
  if (!connections) {
    return;
  }

  const uniqueConnections = connections.reduce((acc: Array<{ name: string }>, cur) => {
    const isPresent = acc.some(integration => integration.name === cur.name);
    if (!isPresent) {
      acc.push(cur);
    }
    return acc;
  }, []);

  return (
    <div className="grid grid-cols-4 max-w-72 gap-x-5 gap-3">
      {uniqueConnections.map(({ name }) => (
        <Link
          key={name}
          href={'#'}
          className="rounded bg-arkw-bg-4 h-16 w-16 hover:translate-x-0.5 transition-all grid place-items-center hover:shadow-sm"
        >
          <Icon name={name.toLowerCase() as IconName} className="w-8 h-8" />
        </Link>
      ))}
    </div>
  );
};
