import Link from 'next/link';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

type ConnectionListProps = {
  connections: Array<{
    name: string;
    referenceId: string;
    apis: any;
  }>;
};
export const ConnectionList = ({ connections }: ConnectionListProps) => {
  if (!connections) {
    return;
  }

  return (
    <div className="grid relative grid-cols-4 max-w-72 gap-x-5 gap-3">
      {connections.map(({ name }) => (
        <Link
          key={name}
          href={'#'}
          className="rounded peer group bg-arkw-bg-4 h-16 w-16 hover:translate-x-0.5 transition-all grid place-items-center hover:shadow-sm"
        >
          <Icon name={name.toLowerCase() as IconName} className="w-8 h-8" />
        </Link>
      ))}
      <aside className="peer-hover:block absolute hidden">
        <div>some stuff</div>
      </aside>
    </div>
  );
};
