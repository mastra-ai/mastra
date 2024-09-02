'use client';

import { useState } from 'react';

import Link from 'next/link';

import { Icon } from '@/app/components/icon';
import { IconName } from '@/types/icons';

type ConnectionProps = {
  name: string;
  apiCount: number;
};
export const Connection = ({ name, apiCount }: ConnectionProps) => {
  const [showModal, setShowModal] = useState(false);
  if (!name) {
    return;
  }

  return (
    <>
      <Link
        key={name}
        href={'#'}
        onMouseEnter={() => {
          setShowModal(true);
        }}
        onMouseLeave={() => {
          setShowModal(false);
        }}
        className="rounded peer group bg-arkw-bg-4 h-16 w-16 hover:translate-x-0.5 transition-all grid place-items-center hover:shadow-sm"
      >
        <Icon name={name.toLowerCase() as IconName} className="w-8 h-8" />
      </Link>
      {showModal ? (
        <aside className="absolute flex items-center gap-3 p-2 right-3 top-12 bg-arkw-bg-3 border-[0.5px] rounded border-arkw-border-1 w-60 h-30">
          <span className="rounded bg-arkw-bg-4 h-8 w-8 grid place-items-center">
            <Icon name={name.toLowerCase() as IconName} className="text-arkw-el-6" />
          </span>
          <div>Apis: {apiCount}</div>
        </aside>
      ) : (
        <></>
      )}
    </>
  );
};
