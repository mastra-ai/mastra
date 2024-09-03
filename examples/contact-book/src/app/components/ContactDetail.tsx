'use client';

import { Input, Modal, ModalContent, ModalHeader, ModalBody } from '@nextui-org/react';
import React from 'react';

import { saveRecordData } from '@/app/actions/record';

interface Props extends React.HTMLProps<HTMLDivElement> {
  contact: any;
  onOpenChange: (open: boolean) => void;
}

export const ContactDetail: React.FC<Props> = props => {
  return (
    <Modal
      scrollBehavior="inside"
      isOpen={props.contact !== null}
      onOpenChange={props.onOpenChange}
      placement="center"
      backdrop="opaque"
      size="full"
      classNames={{
        wrapper: 'flex justify-end',
      }}
      motionProps={{
        variants: {
          enter: {
            x: 0,
            opacity: 1,
            transition: {
              duration: 0.3,
              ease: 'easeOut',
            },
          },
          exit: {
            x: 50,
            opacity: 0,
            transition: {
              duration: 0.2,
              ease: 'easeIn',
            },
          },
        },
      }}
      className="rounded-md max-w-sm w-full h-screen max-h-screen"
    >
      <ModalHeader />
      <ModalContent>
        {() => {
          const { firstName, lastName } = props.contact.data;
          const name = firstName && lastName ? [firstName, lastName].join(' ') : 'Name Unavailable';

          return (
            <>
              <>
                <ModalHeader className="flex flex-col gap-1">{name}</ModalHeader>
                <ModalBody>
                  <form className={'flex flex-col gap-2'}>
                    <Input
                      name={'email'}
                      autoFocus
                      label="Email"
                      placeholder="Enter contact email"
                      variant="bordered"
                      defaultValue={props.contact.data.email}
                      onValueChange={async value => {
                        await saveRecordData(props.contact.id, { email: value });
                      }}
                    />
                    <Input
                      name={'phone'}
                      type={'tel'}
                      label="Phone Number"
                      placeholder="Enter contact phone number"
                      variant="bordered"
                      defaultValue={props.contact.data.phone}
                      onValueChange={async value => {
                        await saveRecordData(props.contact.id, { phone: value });
                      }}
                    />
                  </form>
                </ModalBody>
              </>
            </>
          );
        }}
      </ModalContent>
    </Modal>
  );
};

export default ContactDetail;
