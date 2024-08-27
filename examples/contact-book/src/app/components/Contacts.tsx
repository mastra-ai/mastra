import { default as arkw } from '@arkw/config';
import { Divider, Card, CardBody, CardHeader } from '@nextui-org/react';

import { getSession } from '@/app/actions/session';

export const Contacts = async () => {
  const sessionId = (await getSession())!;
  const integrations = await arkw.connectedIntegrations({
    context: {
      referenceId: sessionId,
    },
  });

  const contacts = integrations.map(integration => {
    return integration.query({
      referenceId: sessionId,
      entityType: 'contact',
    });
  });

  return (
    <div className={'m-4 space-x-0'}>
      <Divider className={'m-4'} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader>Header</CardHeader>
          <CardBody>Contact</CardBody>
        </Card>
      </div>
    </div>
  );
};
