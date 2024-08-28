import { default as arkw } from '@arkw/config';
import { Divider, Card, CardBody, CardHeader, Avatar } from '@nextui-org/react';

import { getSession } from '@/app/actions/session';
import { ContactCardHeader } from '@/app/components/ContactCardHeader';

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map(contact => (
          <Card key={contact.id}>
            <CardHeader>
              <ContactCardHeader contact={contact} />
            </CardHeader>
            <CardBody></CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};
