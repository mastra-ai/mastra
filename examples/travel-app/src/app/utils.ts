import { z } from "zod";

export const flightSchema = z.object({
  airline: z.string(),
  flightNumber: z.string(),
  departureTime: z.string(),
  departureAirport: z.string(),
  departureCity: z.string(),

  arrivalTime: z.string(),
  arrivalAirport: z.string(),
  arrivalCity: z.string(),

  duration: z.string(),
  price: z.number(),
  stops: z.number(),

  layover: z
    .object({
      airport: z.string(),
      city: z.string(),

      depatureToLayoverDuration: z.string(),
      layoverToDestinationDuration: z.string(),
      //from origin
      arrivalTime: z.string(),
      //to final destination
      departureTime: z.string(),

      durationAtLayover: z.string(),
      airline: z.string(),
    })
    .nullable(),
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
