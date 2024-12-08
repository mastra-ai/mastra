// TODO: convert into an integration

import { Attraction, AttractionApiResponse, Flight, FlightApiResponse, Hotel, HotelApiResponse } from "@/lib/types";


export class Booking {
    uri: string;
    token: string;
    constructor({ token }: { token: string }) {
        const uri = `https://booking-com15.p.rapidapi.com`
        const apiV = `api/v1`
        this.uri = `${uri}/${apiV}`
        this.token = token
    }

    async getAttractions({ destination }: { destination: string }) {
        const url = `${this.uri}/attraction/searchAttractions?id=${destination}&sortBy=trending&page=1&currency_code=USD&languagecode=en-us`;
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
            console.log('attractions', result);
            console.log(result?.data?.products[0]);

            return result?.data?.products.map(
                (attraction: AttractionApiResponse): Attraction => ({
                    id: attraction.id,
                    name: attraction.name,
                    description: attraction.shortDescription,
                    price: Number(attraction.representativePrice?.publicAmount) || 0,
                    imageUrl: attraction.primaryPhoto?.small || '/placeholder-attraction.jpg',
                    location: attraction.ufiDetails?.bCityName || 'Unknown Location',
                    duration: attraction.duration || undefined,
                    rating: attraction.reviewsStats?.combinedNumericStats?.average || 0,
                    reviewCount: attraction.reviewsStats?.allReviewsCount || 0,
                    hasFreeCancellation: attraction.cancellationPolicy?.hasFreeCancellation || false,
                }),
            );
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    async getHotels({ startDate, endDate, destination }: { startDate: string, endDate: string, destination: string }) {
        const url = `${this.uri}/hotels/searchHotels?dest_id=${destination}&search_type=CITY&arrival_date=${startDate}&departure_date=${endDate}&adults=1&room_qty=1&page_number=1&units=metric&temperature_unit=c&languagecode=en-us&currency_code=USD`;
        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-key': this.token,
                'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
            },
        };

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            console.log('hotels', result);
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
    }

    async getFlights({
        startDate,
        endDate,
        origin,
        destination,
    }: { startDate: string, endDate: string, origin: string, destination: string }) {
        const url = `${this.uri}/flights/searchFlights?fromId=${origin}&toId=${destination}&departDate=${startDate}&returnDate=${endDate}&pageNo=1&adults=1&sort=BEST&cabinClass=ECONOMY&currency_code=USD`;

        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-key': this.token,
                'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
            },
        };

        try {
            const response = await fetch(url, options);
            const result = await response.json();
            console.log('flights', result);
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
    }
}
