import type { JsonSchema } from './types';

export const complexSchema: JsonSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      title: 'User',
      properties: {
        email: { type: 'string', title: 'Email' },
        roles: {
          type: 'array',
          title: 'Roles',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Role Name' },
              permissions: { type: 'string', title: 'Permissions' },
            },
          },
        },
        address: {
          type: 'object',
          title: 'Address',
          properties: {
            street: { type: 'string', title: 'Street' },
            city: { type: 'string', title: 'City' },
            country: { type: 'string', title: 'Country' },
            zipCode: { type: 'string', title: 'Zip Code' },
          },
        },
      },
    },
    metadata: {
      type: 'object',
      title: 'Metadata',
      properties: {
        createdAt: { type: 'string', title: 'Created At' },
        updatedAt: { type: 'string', title: 'Updated At' },
        version: { type: 'number', title: 'Version' },
      },
    },
  },
};
