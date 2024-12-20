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
  layover: z
    .object({
      airport: z.string(),
      city: z.string(),
      arrivalTime: z.string(),
      departureTime: z.string(),
      duration: z.string(),
      airline: z.string(),
    })
    .optional(),
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
  }),
  accommodation: accommodationSchema,
  attractions: attractionsSchema,
});

export type TravelSchemaProps = z.infer<typeof travelSchema>;
