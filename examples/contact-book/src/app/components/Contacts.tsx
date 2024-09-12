import { default as kepler } from '@kpl/config';
import { Divider } from '@nextui-org/react';

import { getSession } from '@/app/actions/session';
import { ContactList } from '@/app/components/ContactList';

export const Contacts = async () => {
  const sessionId = (await getSession())!;
  const integrations = await kepler.connectedIntegrations({
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
