import { Attraction, AttractionApiResponse } from '@/lib/types';

export async function getAttractionList() {
  const url =
    'https://booking-com15.p.rapidapi.com/api/v1/attraction/searchLocation?query=united%20states&languagecode=en-us';
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

    return result?.data;
  } catch (error) {
    return [];
  }
}

export async function getFlights() {
  const url = 'https://booking-com15.p.rapidapi.com/api/v1/flights/searchDestination?query=united%20states';
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
    return result?.data;
  } catch (error) {
    return [];
  }
}

export async function getHotels() {
  const url = 'https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=united%20states';
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
    return result?.data;
  } catch (error) {
    return [];
  }
}

export const getAttractions = async (destination: string) => {
  const url = `https://booking-com15.p.rapidapi.com/api/v1/attraction/searchAttractions?id=${destination}&sortBy=trending&page=1&currency_code=USD&languagecode=en-us`;
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
};
