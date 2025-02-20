/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: convert into an integration

import type {
  AirbnbLocation,
  AirbnbPlace,
  Attraction,
  AttractionApiResponse,
  Flight,
  FlightApiResponse,
  Hotel,
  HotelApiResponse,
} from "@/lib/types";
import type { StepResult } from "@mastra/core/workflows";

export class Booking {
  uri: string;
  token: string;
  constructor({ token }: { token: string }) {
    const uri = `https://booking-com15.p.rapidapi.com`;
    const apiV = `api/v1`;
    this.uri = `${uri}/${apiV}`;
    this.token = token;
  }

  async getAttractions({ destination }: { destination: string }) {
    const url = `${this.uri}/attraction/searchAttractions?id=${destination}&sortBy=trending&page=1&currency_code=USD&languagecode=en-us`;
    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-key": process.env.RAPID_API_KEY || "",
        "x-rapidapi-host": "booking-com15.p.rapidapi.com",
      },
    };
    console.log("Fetching attractions", { destination, url });
    try {
      const response = await fetch(url, options);
      const result = await response.json();
      console.log("attractions", result);
      return result?.data?.products.slice(0, 5).map(
        (attraction: AttractionApiResponse): Attraction => ({
          id: attraction.id,
          name: attraction.name,
          description: attraction.shortDescription,
          price: Number(attraction.representativePrice?.publicAmount) || 0,
          imageUrl:
            attraction.primaryPhoto?.small || "/placeholder-attraction.jpg",
          location: attraction.ufiDetails?.bCityName || "Unknown Location",
          duration: attraction.duration || undefined,
          rating: attraction.reviewsStats?.combinedNumericStats?.average || 0,
          reviewCount: attraction.reviewsStats?.allReviewsCount || 0,
          hasFreeCancellation:
            attraction.cancellationPolicy?.hasFreeCancellation || false,
        }),
      );
    } catch (error) {
      console.log("error---getAttractions", error);
      return [];
    }
  }

  async getHotels({
    startDate,
    endDate,
    destination,
  }: {
    startDate: string;
    endDate: string;
    destination: string;
  }) {
    const url = `${this.uri}/hotels/searchHotels?dest_id=${destination}&search_type=CITY&arrival_date=${startDate}&departure_date=${endDate}&adults=1&room_qty=1&page_number=1&units=metric&temperature_unit=c&languagecode=en-us&currency_code=USD`;
    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-key": this.token,
        "x-rapidapi-host": "booking-com15.p.rapidapi.com",
      },
    };

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      // Calculate number of nights
      const start = new Date(startDate);
      const end = new Date(endDate);
      const numberOfNights = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      return result?.data?.hotels.slice(0, 5).map(
        (hotel: HotelApiResponse): Hotel => ({
          id: hotel.property.name,
          name: hotel.property.name,
          location: hotel.property.wishlistName,
          address: `${hotel.property.latitude}, ${hotel.property.longitude}`,
          rating: hotel.property.reviewScore,
          pricePerNight:
            hotel.property.priceBreakdown.grossPrice.value / numberOfNights,
          imageUrl: hotel.property.photoUrls[0],
          description: hotel.accessibilityLabel,
          reviewScore: hotel.property.reviewScore,
          amenities: [],
        }),
      );
    } catch (error) {
      console.error(error);
    }
  }

  async getFlights({
    startDate,
    endDate,
    origin,
    destination,
  }: {
    startDate: string;
    endDate: string;
    origin: string;
    destination: string;
  }) {
    const url = `${this.uri}/flights/searchFlights?fromId=${origin}&toId=${destination}&departDate=${startDate}&returnDate=${endDate}&pageNo=1&adults=1&sort=BEST&cabinClass=ECONOMY&currency_code=USD`;

    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-key": this.token,
        "x-rapidapi-host": "booking-com15.p.rapidapi.com",
      },
    };

    try {
      const response = await fetch(url, options);
      const result = await response.json();

      if (!result?.data?.flightOffers) {
        console.error("No flight offers found", result);
        return [];
      }

      const firstFiveItems = result.data.flightOffers.slice(0, 5);

      const flights = firstFiveItems.map(
        (flight: FlightApiResponse): Flight => {
          return {
            airline: flight.segments[0].legs[0].carriersData[0].name,
            flightNumber: `${flight.segments[0].legs[0].flightInfo.carrierInfo.marketingCarrier}${flight.segments[0].legs[0].flightInfo.flightNumber}`,
            departureAirport: flight.segments[0].departureAirport.code,
            departureCity: flight.segments[0].departureAirport.cityName,
            departureTime: new Date(flight.segments[0].departureTime),
            arrivalAirport: flight.segments[0].arrivalAirport.code,
            arrivalCity: flight.segments[0].arrivalAirport.cityName,
            arrivalTime: new Date(flight.segments[0].arrivalTime),
            duration: `${Math.floor(flight.segments[0].totalTime / 60)}h ${flight.segments[0].totalTime % 60}m`,
            price:
              flight.priceBreakdown.total.units +
              flight.priceBreakdown.total.nanos / 1000000000,
            legs: flight.segments[0].legs.map((leg: Record<string, any>) => ({
              departureAirport: leg.departureAirport.code,
              departureCity: leg.departureAirport.cityName,
              arrivalAirport: leg.arrivalAirport.code,
              arrivalCity: leg.arrivalAirport.cityName,
              departureTime: new Date(leg.departureTime),
              arrivalTime: new Date(leg.arrivalTime),
              duration: `${Math.floor(leg.totalTime / 60)}h ${leg.totalTime % 60}m`,
            })),
          };
        },
      );

      return flights;
    } catch (error) {
      console.error(error);
    }
  }

  async getAirbnbSearchPlaces({
    place,
    country = "usa",
  }: {
    place: string;
    country?: string;
  }) {
    const url = `${this.uri}/searchDestination?query=${place}&country=${country}`;

    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-key": this.token,
        "x-rapidapi-host": "airbnb19.p.rapidapi.com",
      },
    };

    try {
      const response = await fetch(url, options);
      const result = (await response.json()) as { data: AirbnbLocation[] };
      console.log("airbnb places", result);

      if (result.data.length > 0) {
        return result.data[0];
      }
      throw new Error("No airbnb places found");
    } catch (error) {
      console.error(error);
    }
  }

  async getAirbnb({
    placeId,
    checkIn,
    checkOut,
    typeOfPlace,
    payload,
  }: {
    placeId: string;
    checkIn: string;
    checkOut: string;
    typeOfPlace: string;
    payload?: StepResult<{ id: string }>;
  }) {
    let place = placeId;

    if (payload?.status === "success") {
      place = payload.output?.id;
    }

    const url = `${this.uri}/searchPropertyByPlace?id=${place}&totalRecords=10&currency=USD&adults=1&typeOfPlace=${typeOfPlace}&checkin=${checkIn}&checkout=${checkOut}`;

    const options = {
      method: "GET",
      headers: {
        "x-rapidapi-key": this.token,
        "x-rapidapi-host": "airbnb19.p.rapidapi.com",
      },
    };

    console.log("Fetching airbnb", { url });

    try {
      const response = await fetch(url, options);
      const result = (await response.json()) as { data: AirbnbPlace[] };
      console.log("airbnb result", result);
      return result.data
        .slice(0, 5)
        .map(
          ({
            adults,
            avgRating,
            bathrooms,
            bedrooms,
            beds,
            city,
            images,
            price,
            roomType,
            summary,
            title,
            publicAddress,
            ...rest
          }) => {
            console.log(rest);
            return {
              adults,
              avgRating,
              bathrooms,
              bedrooms,
              beds,
              city,
              images,
              price,
              roomType,
              summary,
              title,
              url,
              publicAddress,
            };
          },
        );
    } catch (error) {
      console.error("error---getAirbnb", error);
    }
  }
}
