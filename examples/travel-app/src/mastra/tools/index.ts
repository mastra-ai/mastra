import { createTool } from '@mastra/core';
import { z } from 'zod';

// export const getFlights = async (startDate: string, endDate: string, origin: string, destination: string) => {
//   const url = `https://booking-com15.p.rapidapi.com/api/v1/flights/searchFlights?fromId=${origin}&toId=${destination}&departDate=${startDate}&returnDate=${endDate}&pageNo=1&adults=1&children=0%2C17&sort=BEST&cabinClass=ECONOMY&currency_code=AED`;
//   const options = {
//     method: 'GET',
//     headers: {
//       'x-rapidapi-key': '21683b248dmshe4f4f3f257be193p1c29bdjsn56437a85313e',
//       'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
//     },
//   };

//   try {
//     const response = await fetch(url, options);
//     const result = await response.text();
//     console.log(result);
//   } catch (error) {
//     console.error(error);
//   }
// };

// export const searchFlights = createTool({
//   label: 'Get Flight Info',
//   schema: z.object({
//     startDate: z.string(),
//     endDate: z.string(),
//     origin: z.string(),
//     destination: z.string(),
//   }),
//   description: `Fetches flight information for a given date range, origin and destination`,
//   executor: async ({ data: { startDate, endDate, origin, destination } }) => {
//     console.log('Using tool to fetch flight information: ', startDate, endDate, origin, destination);
//     return {
//       flights: await getFlights(startDate, endDate, origin, destination),
//     };
//   },
// });

const getHotels = async (location: string) => {
  const url = 'https://travel-advisor.p.rapidapi.com/attraction-filters/v2/list?currency=USD&units=km&lang=en_US';
  const options = {
    method: 'POST',
    headers: {
      'x-rapidapi-key': '21683b248dmshe4f4f3f257be193p1c29bdjsn56437a85313e',
      'x-rapidapi-host': 'travel-advisor.p.rapidapi.com',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      geoId: 293928,
      startDate: '2024-12-01',
      endDate: '2024-12-04',
      pax: [
        {
          ageBand: 'ADULT',
          count: 2,
        },
      ],
      sort: 'TRAVELER_FAVORITE_V2',
      sortOrder: 'asc',
      filters: [
        {
          id: 'category',
          value: ['40'],
        },
        {
          id: 'rating',
          value: ['40'],
        },
        {
          id: 'navbar',
          value: ['ATTRACTIONOVERVIEW:-true'],
        },
      ],
    }),
  };

  try {
    const response = await fetch(url, options);
    const result = await response.text();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
  }
};

export const searchHotels = createTool({
  label: 'Search Hotels',
  schema: z.object({
    location: z.string(),
  }),
  description: `Searches for hotels in a specified location`,
  executor: async ({ data: { location } }) => {
    console.log('Using tool to search hotels in location: ', location);
    return {
      hotels: await getHotels(location),
    };
  },
});
