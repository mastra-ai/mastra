'use client';

import { Avatar, Link } from '@nextui-org/react';

type ContactCardHeaderProps = {
  contact: {
    id: string;
    data: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
  };
};

export const ContactCardHeader = (props: ContactCardHeaderProps) => {
  const { firstName, lastName } = props.contact.data;
  const name = firstName && lastName ? [firstName, lastName].join(' ') : 'Name Unavailable';

  return (
    <div className={'flex flex-row'}>
      <Avatar className={'mr-4'} src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${props.contact.id}`} />
      <div className={'flex flex-col'}>
        <h4 className={`text-left ${name === 'Name Unavailable' ? 'italic opacity-60' : 'text-2xl font-light'}`}>
          {name}
        </h4>
        <Link
          className={'text-xs max-w-xs truncate font-medium text-gray-600'}
          href={`mailto:${props.contact.data.email}`}
        >
          {props.contact.data.email}
        </Link>
      </div>
    </div>
  );
};
