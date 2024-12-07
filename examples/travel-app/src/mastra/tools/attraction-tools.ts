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
