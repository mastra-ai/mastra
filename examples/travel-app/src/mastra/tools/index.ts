import { createTool } from '@mastra/core';
import { z } from 'zod';

import { Flight, Hotel, Attraction, FlightApiResponse, HotelApiResponse } from '@/lib/types';

import { getAttractions } from './attraction-tools';

export const getFlights = async (startDate: string, endDate: string, origin: string, destination: string) => {
  const url = `https://booking-com15.p.rapidapi.com/api/v1/flights/searchFlights?fromId=${origin}&toId=${destination}&departDate=${startDate}&returnDate=${endDate}&pageNo=1&adults=1&sort=BEST&cabinClass=ECONOMY&currency_code=USD`;
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': process.env.RAPID_API_KEY || '',
      'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
    },
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    return result?.data?.flightOffers.map(
      (flight: FlightApiResponse): Flight => ({
        airline: flight.segments[0].legs[0].carriersData[0].name,
        flightNumber: `${flight.segments[0].legs[0].flightInfo.carrierInfo.marketingCarrier}${flight.segments[0].legs[0].flightInfo.flightNumber}`,
        departureAirport: flight.segments[0].departureAirport.code,
        departureCity: flight.segments[0].departureAirport.cityName,
        departureTime: new Date(flight.segments[0].departureTime),
        arrivalAirport: flight.segments[0].arrivalAirport.code,
        arrivalCity: flight.segments[0].arrivalAirport.cityName,
        arrivalTime: new Date(flight.segments[0].arrivalTime),
        duration: `${Math.floor(flight.segments[0].totalTime / 60)}h ${flight.segments[0].totalTime % 60}m`,
        price: flight.priceBreakdown.total.units + flight.priceBreakdown.total.nanos / 1000000000,
      }),
    );
  } catch (error) {
    console.error(error);
  }
};

export const searchFlights = createTool({
  label: 'Get Flight Info',
  schema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    origin: z.string(),
    destination: z.string(),
  }),
  description: `Fetches flight information for a given date range, origin and destination`,
  executor: async ({ data: { startDate, endDate, origin, destination } }) => {
    console.log('Using tool to fetch flight information: ', startDate, endDate, origin, destination);
    const flights = await getFlights(startDate, endDate, origin, destination);
    return {
      flights: flights as Flight[],
    };
  },
});

const getHotels = async (startDate: string, endDate: string, destination: string) => {
  const url = `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels?dest_id=${destination}&search_type=CITY&arrival_date=${startDate}&departure_date=${endDate}&adults=1&room_qty=1&page_number=1&units=metric&temperature_unit=c&languagecode=en-us&currency_code=USD`;
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': process.env.RAPID_API_KEY || '',
      'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
    },
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    // Calculate number of nights
    const start = new Date(startDate);
    const end = new Date(endDate);
    const numberOfNights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    return result?.data?.hotels.map(
      (hotel: HotelApiResponse): Hotel => ({
        name: hotel.property.name,
        location: hotel.property.wishlistName,
        address: `${hotel.property.latitude}, ${hotel.property.longitude}`,
        rating: hotel.property.reviewScore,
        pricePerNight: hotel.property.priceBreakdown.grossPrice.value / numberOfNights,
        imageUrl: hotel.property.photoUrls[0],
        description: hotel.accessibilityLabel,
        amenities: [],
        phoneNumber: '',
      }),
    );
  } catch (error) {
    console.error(error);
  }
};

export const searchHotels = createTool({
  label: 'Search Hotels',
  schema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    destination: z.string(),
  }),
  description: `Searches for hotels in a specified location`,
  executor: async ({ data: { startDate, endDate, destination } }) => {
    console.log('Using tool to search hotels: ', startDate, endDate, destination);
    return {
      hotels: (await getHotels(startDate, endDate, destination)) as Hotel[],
    };
  },
});

export const searchAttractions = createTool({
  label: 'Search Attractions',
  schema: z.object({
    destination: z.string(),
  }),
  description: `Searches for attractions in a specified location`,
  executor: async ({ data: { destination } }) => {
    console.log('Using tool to search attractions: ', destination);
    const attractions = await getAttractions(destination);
    return {
      attractions: attractions.map((attraction: Attraction) => ({
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
