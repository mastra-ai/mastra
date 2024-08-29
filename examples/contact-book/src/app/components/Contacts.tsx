import { default as arkw } from '@arkw/config';
import { Divider, Card, CardBody, CardHeader, Avatar } from '@nextui-org/react';

import { getSession } from '@/app/actions/session';
import { ContactCardHeader } from '@/app/components/ContactCardHeader';
import { ContactDetail } from '@/app/components/ContactDetail';
import { ContactList } from '@/app/components/ContactList';

export const Contacts = async () => {
  const sessionId = (await getSession())!;
  const integrations = await arkw.connectedIntegrations({
    context: {
      referenceId: sessionId,
    },
  });

  const contacts = (
    await Promise.all(
      integrations.map(async integration => {
        return await integration.query({
          referenceId: sessionId,
          entityType: 'CONTACTS',
        });
      }),
    )
  ).flat();

  return (
    <div className={'m-4 space-x-0'}>
      {contacts.length ? <Divider className={'m-4'} /> : null}
      <ContactList contacts={contacts} />
    </div>
  );
};
