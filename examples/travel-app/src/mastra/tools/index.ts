import { createTool } from '@mastra/core';
import { z } from 'zod';

import { Flight, Hotel, Attraction } from '@/lib/types';

import { Booking } from '../integrations/Booking';

const booking = new Booking({ token: process.env.RAPID_API_KEY || '' });

export const searchFlights = createTool({
  label: 'Get Flight Info',
  schema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    origin: z.string(),
    destination: z.string(),
  }),
  description: `Fetches flight information for a given date range, origin and destination. Origin and Destination are Airport codes like DFW.AIRPORT or SEA.AIRPORT`,
  executor: async ({ data: { startDate, endDate, origin, destination } }) => {
    console.log('Using tool to fetch flight information: ', startDate, endDate, origin, destination);
    const flights = await booking.getFlights({ startDate, endDate, origin, destination });
    return {
      flights: flights as Flight[],
    };
  },
});

export const searchHotels = createTool({
  label: 'Search Hotels',
  schema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    destination: z.string(),
  }),
  description: `Searches for hotels in a specified location. Destination is a cityId like 20015732 for 20015733`,
  executor: async ({ data: { startDate, endDate, destination } }) => {
    console.log('Using tool to search hotels: ', startDate, endDate, destination);
    return {
      hotels: (await booking.getHotels({ startDate, endDate, destination })) as Hotel[],
    };
  },
});

export const searchAttractions = createTool({
  label: 'Search Attractions',
  schema: z.object({
    destination: z.string(),
  }),
  description: `Searches for attractions in a specified location. Destination is a cityId like 20015732 for 20015733`,
  executor: async ({ data: { destination } }) => {
    console.log('Using tool to search attractions: ', destination);
    const attractions = await booking.getAttractions({ destination });
    return {
      attractions: (attractions || []).map((attraction: Attraction) => ({
        id: attraction.id,
        name: attraction.name,
        location: attraction.location,
        imageUrl: attraction.imageUrl,
        description: attraction.description,
        price: attraction.price,
        duration: attraction.duration,
      })),
    };
  },
});
