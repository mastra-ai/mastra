export async function getAttractionList(query: string) {
  const url = `https://booking-com15.p.rapidapi.com/api/v1/attraction/searchLocation?query=${encodeURIComponent(query)}&languagecode=en-us`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": process.env.RAPID_API_KEY || "",
      "x-rapidapi-host": "booking-com15.p.rapidapi.com",
    },
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    return result?.data;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getFlights() {
  const url =
    "https://booking-com15.p.rapidapi.com/api/v1/flights/searchDestination?query=united%20states";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": process.env.RAPID_API_KEY || "",
      "x-rapidapi-host": "booking-com15.p.rapidapi.com",
    },
  };
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return result?.data;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getHotels(query: string) {
  const url = `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=${encodeURIComponent(query)}`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": process.env.RAPID_API_KEY || "",
      "x-rapidapi-host": "booking-com15.p.rapidapi.com",
    },
  };
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return result?.data;
  } catch (error) {
    console.error("Error fetching hotels:", error);
    return [];
  }
}
