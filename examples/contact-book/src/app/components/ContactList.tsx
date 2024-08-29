'use client';

import { Card, CardBody, CardHeader } from '@nextui-org/react';
import { useState } from 'react';

import { ContactCardHeader } from '@/app/components/ContactCardHeader';
import { ContactDetail } from '@/app/components/ContactDetail';

export type ContactListProps = {
  contacts: any[];
};

export const ContactList = (props: ContactListProps) => {
  const [selectedContact, setSelectedContact] = useState(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {props.contacts.map(contact => (
          <Card key={contact.id} isPressable onPress={() => setSelectedContact(contact)}>
            <CardHeader>
              <ContactCardHeader contact={contact} />
            </CardHeader>
            <CardBody></CardBody>
          </Card>
        ))}
      </div>
      <ContactDetail contact={selectedContact} onOpenChange={() => setSelectedContact(null)} />
    </>
  );
};
