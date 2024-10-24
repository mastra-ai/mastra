import { framework } from '@/lib/framework-utils';

import EmailsClientLayout, { Email } from './emails-client-layout';

export default async function Emails() {
  const connectionId = 'user-1';

  const googleIntegration = framework?.getIntegration('GOOGLE');

  const recordData = await googleIntegration?.query({
    connectionId,
    entityType: 'EMAIL',
    sort: ['asc(createdAt)'],
  });

  const emails = recordData?.map((record: any) => record.data) || [];
  return <EmailsClientLayout emails={emails as Email[]} />;
}
