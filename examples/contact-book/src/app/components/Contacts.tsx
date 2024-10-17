import { default as mastra } from '@mastra/config';
import { Divider } from '@nextui-org/react';

import { ContactList } from '@/components/ContactList';

import { getSession } from '@/app/actions/session';

export const Contacts = async () => {
  const sessionId = (await getSession())!;
  const integrations = await mastra.connectedIntegrations({
    context: {
      connectionId: sessionId,
    },
  });

  const contacts = (
    await Promise.all(
      integrations.map(async integration => {
        return await integration.query({
          connectionId: sessionId,
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
