import { createSync } from '@mastra/core';
import { z } from 'zod';

import { getFlights, getHotels, getAttractionList } from '../tools/attraction-tools';

export const syncBookingCom = createSync({
  label: 'Sync Booking',
  description: 'Sync data from Booking RapidAPI',
  schema: z.object({}),
  executor: async ({ engine }) => {
    const flights = await getFlights();
    await engine.syncRecords({
      connectionId: `SYSTEM`,
      name: 'Flight',
      records: flights.map((f: any) => ({
        data: f,
        externalId: f.id,
      })),
    });

    const attractions = await getAttractionList();
    await engine.syncRecords({
      connectionId: `SYSTEM`,
      name: 'Attraction',
      records: attractions?.products?.map((location: any) => ({
        data: location,
        externalId: location.id,
      })),
    });

    const hotels = await getHotels();
    await engine.syncRecords({
      connectionId: `SYSTEM`,
      name: 'Hotel',
      records: hotels?.map((h: any) => ({
        data: h,
        externalId: h.dest_id,
      })),
    });

    return {};
  },
});
