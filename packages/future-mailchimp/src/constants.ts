import { FieldTypes } from 'core'
import { getPath } from '@/lib/utils/object';

import { MailchimpMember } from './types';

export const MAILCHIMP_HOST = 'https://login.mailchimp.com';

export const MAILCHIMP_RECORD_TYPE_NAME = 'people';

export const MAILCHIMP_FIELDS = [
  {
    name: `firstName`,
    displayName: `First Name`,
    order: 0,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: `lastName`,
    displayName: `Last Name`,
    order: 1,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: `email`,
    displayName: `Email`,
    order: 2,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: `phone`,
    displayName: `Phone`,
    order: 3,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: `birthday`,
    displayName: `Birthday`,
    order: 4,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: `address`,
    displayName: `Address`,
    order: 5,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: 'address2',
    displayName: 'Address 2',
    order: 6,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: 'city',
    displayName: 'City',
    order: 7,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: 'State',
    displayName: 'state',
    order: 8,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: 'country',
    displayName: 'Country',
    order: 9,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  {
    name: 'zipcode',
    displayName: 'Zipcode',
    order: 10,
    type: FieldTypes.SINGLE_LINE_TEXT,
  },
  // TODO: Multi-select needs to support ad-hoc options
  // {
  //   name: `tags`,
  //   displayName: `Tags`,
  //   order: 11,
  //   type: FieldTypes.MULTI_SELECT,
  // },
];

const MAILCHIMP_MEMBER_TO_PERSON = {
  _externalId: 'unique_email_id',
  firstName: 'merge_fields.FNAME',
  lastName: 'merge_fields.LNAME',
  email: 'email_address',
  phone: 'merge_fields.PHONE',
  birthday: 'merge_fields.BIRTHDAY',
  address: (m: MailchimpMember) => getPath(m, 'merge_fields.ADDRESS.addr1'),
  address2: (m: MailchimpMember) => getPath(m, 'merge_fields.ADDRESS.addr2'),
  city: (m: MailchimpMember) => getPath(m, 'merge_fields.ADDRESS.city'),
  state: (m: MailchimpMember) => getPath(m, 'merge_fields.ADDRESS.state'),
  zipcode: (m: MailchimpMember) => getPath(m, 'merge_fields.ADDRESS.zip'),
  country: (m: MailchimpMember) => getPath(m, 'merge_fields.ADDRESS.country'),
  // tags: (m: MailchimpMember) => m.tags?.map((tag: { name: string }) => tag.name).join(', '),
};

export const mapMailchimpMemberToPersonRecord = (member: MailchimpMember) => {
  return Object.entries(MAILCHIMP_MEMBER_TO_PERSON).reduce(
    (acc, [key, path]) => {
      acc[key] = typeof path === 'function' ? path(member) : getPath(member, path);

      if (acc[key]) {
        acc[key] = acc[key].trim();
      }

      return acc;
    },
    {} as Record<string, any>,
  );
};
