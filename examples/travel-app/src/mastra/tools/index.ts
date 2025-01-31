import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { Flight, Hotel, Attraction } from "@/lib/types";

import { Booking } from "../integrations/Booking";

const booking = new Booking({ token: process.env.RAPID_API_KEY || "" });

export const searchFlights = createTool({
  id: "Get Flight Info",
  inputSchema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    origin: z.string(),
    destination: z.string(),
  }),
  description: `Fetches flight information for a given date range, origin and destination. Origin and Destination are Airport codes like DFW.AIRPORT or SEA.AIRPORT`,
  execute: async ({ context: { startDate, endDate, origin, destination } }) => {
    console.log(
      "Using tool to fetch flight information: ",
      startDate,
      endDate,
      origin,
      destination,
    );
    const flights = await booking.getFlights({
      startDate,
      endDate,
      origin,
      destination,
    });
    return {
      flights: flights as Flight[],
    };
  },
});

export const searchHotels = createTool({
  id: "Search Hotels",
  inputSchema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    destination: z.string(),
  }),
  description: `Searches for hotels in a specified location. Destination is a cityId like 20015732 for 20015733`,
  execute: async ({ context: { startDate, endDate, destination } }) => {
    console.log(
      "Using tool to search hotels: ",
      startDate,
      endDate,
      destination,
    );
    return {
      hotels: (await booking.getHotels({
        startDate,
        endDate,
        destination,
      })) as Hotel[],
    };
  },
});

export const searchAttractions = createTool({
  id: "Search Attractions",
  inputSchema: z.object({
    destination: z.string(),
  }),
  description: `Searches for attractions in a specified location. Destination is a cityId like 20015732 for 20015733`,
  execute: async ({ context: { destination } }) => {
    console.log("Using tool to search attractions: ", destination);
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

export const searchAirbnbLocation = createTool({
  id: "Search Airbnb Location",
  inputSchema: z.object({
    place: z.string(),
  }),
  outputSchema: z.object({
    id: z.string(),
    location_name: z.string(),
    terms: z.array(
      z.object({
        offset: z.number(),
        value: z.string(),
      }),
    ),
    country_code: z.string(),
    countryCode: z.string(),
    display_name: z.string(),
    display_style: z.string(),
  }),
  description: `Searches for Airbnb places in a specified location. Place is a city name like New York, NY`,
  execute: async ({ context: { place } }) => {
    console.log("Using tool to search Airbnb places: ", place);
    const airbnbPlace = await booking.getAirbnbSearchPlaces({ place });

    if (!airbnbPlace) {
      return {
        id: "",
        location_name: "",
        terms: [],
        country_code: "",
        countryCode: "",
        display_name: "",
        display_style: "",
      };
    }

    return airbnbPlace;
  },
});

export const searchAirbnb = createTool({
  id: "Search Airbnb",
  inputSchema: z.object({
    placeId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    typeOfPlace: z.string(),
  }),
  outputSchema: z.object({
    adults: z.number(),
    avgRating: z.number(),
    bathrooms: z.number(),
    bedrooms: z.number(),
    beds: z.number(),
    city: z.string(),
    images: z.array(z.string()),
    price: z.string(),
    roomType: z.string(),
    summary: z.string(),
    title: z.string(),
    url: z.string(),
  }),
  description: `Searches for Airbnb in a specified location. Place is a cityId like 20015732 for 20015733`,
  execute: async ({
    context: { placeId, startDate, endDate, typeOfPlace },
  }) => {
    console.log("Using tool to search Airbnb: ", placeId);
    const airbnbs = await booking.getAirbnb({
      placeId,
      checkIn: startDate,
      checkOut: endDate,
      typeOfPlace,
    });

    if (airbnbs && airbnbs.length > 0) {
      return airbnbs[0];
    }

    return {
      adults: 0,
      avgRating: 0,
      bathrooms: 0,
      bedrooms: 0,
      beds: 0,
      city: "",
      images: [],
      price: "",
      roomType: "",
      summary: "",
      title: "",
      url: "",
    };
  },
});
