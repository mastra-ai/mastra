import { z } from "zod";

export const flightSchema = z.object({
  airline: z.string(),
  flightNumber: z.string(),
  departureTime: z.string(),
  arrivalTime: z.string(),
  duration: z.string(),
  price: z.number(),
  stops: z.number(),
  departureAirport: z.string(),
  arrivalAirport: z.string(),
  departureCity: z.string(),
  arrivalCity: z.string(),
});

const accommodationSchema = z.object({
  name: z.string(),
  rating: z.number(),
  pricePerNight: z.number(),
  location: z.string(),
  address: z.string(),
  description: z.string(),
  amenities: z.array(z.string()),
  imageUrl: z.string(),
  phoneNumber: z.string(),
  reviewScore: z.number(),
});

const attractionsSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    rating: z.number(),
    price: z.number(),
    imageUrl: z.string(),
    location: z.string(),
  }),
);

export const travelSchema = z.object({
  flights: z.object({
    outbound: flightSchema,
    return: flightSchema,
    legs: z.array(
      z.object({
        duration: z.string(),
        airport: z.string(),
      }),
    ),
  }),
  accommodation: accommodationSchema,
  attractions: attractionsSchema,
});

export type TravelSchemaProps = z.infer<typeof travelSchema>;
