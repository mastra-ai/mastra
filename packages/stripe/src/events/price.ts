import { EventHandler, PropertyType } from '@kpl/core';
import { StripeIntegration } from '../';

export const properties = [
  {
    name: 'id',
    displayName: 'id',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'billing_scheme',
    displayName: 'Billing schema',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'created',
    displayName: 'Created',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'currency',
    displayName: 'Currency',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'product',
    displayName: 'Product',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'unit_amount',
    displayName: 'Unit amount',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
  {
    name: 'type',
    displayName: 'Type',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: false,
  },
];

export const priceSync: EventHandler<StripeIntegration> = ({
  eventKey,
  integrationInstance: { name, entityTypes, dataLayer, getApiClient },
}) => ({
  id: `${name}-sync-prices`,
  event: eventKey,
  executor: async ({ event }) => {
    const { connectionId } = event.user;
    const api = await getApiClient({ connectionId });
    //@ts-ignore
    const res = api['/v1/prices'].get();
    //@ts-ignore
    const { data } = await res.json();

    const records = data?.map((price: any) => {
      return {
        externalId: price.id,
        data: price,
        entityType: entityTypes.PRICE,
      };
    })

    await dataLayer?.syncData({
      name,
      connectionId,
      data: records,
      properties,
      type: entityTypes.PRICE,
      lastSyncId: event?.id!,
    });
  },
});

