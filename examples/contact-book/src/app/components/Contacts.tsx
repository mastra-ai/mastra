import { Divider, Card, CardBody, CardHeader } from '@nextui-org/react';

export const Contacts = () => {
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
