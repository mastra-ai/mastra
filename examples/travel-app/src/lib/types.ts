export interface TravelFormData {
  startDate: Date;
  endDate: Date;
  departureLocation: string;
  arrivalLocation: string;
  tripGoals: string;
  preferredFlightTimes: string[];
  flightPriority: number;
  hotelPriceRange: string;
  interests: string[];
}

// TODO: We should use engine and syncs to store these values in the db.
// This just provides some sample data for now.
export const PLACES = [
  {
    value: "ATL.AIRPORT",
    label: "Atlanta (ATL)",
    cityId: "20024809",
    attractionId: "eyJ1ZmkiOjIwMDI0ODA5fQ==",
  },
  {
    value: "LAX.AIRPORT",
    label: "Los Angeles (LAX)",
    cityId: "20014181",
    attractionId: "eyJ1ZmkiOjIwMDE0MTgxfQ==",
  },
  {
    value: "ORD.AIRPORT",
    label: "Chicago (ORD)",
    cityId: "20033173",
    attractionId: "eyJ1ZmkiOjIwMDMzMTczfQ==",
  },
  {
    value: "DFW.AIRPORT",
    label: "Dallas/Fort Worth (DFW)",
    cityId: "20127504",
    attractionId: "eyJ1ZmkiOjIwMTI3NTA0fQ==",
  },
  {
    value: "DEN.AIRPORT",
    label: "Denver (DEN)",
    cityId: "20017349",
    attractionId: "eyJ1ZmkiOjIwMDE3MzQ5fQ==",
  },
  {
    value: "JFK.AIRPORT",
    label: "New York (JFK)",
    cityId: "20088325",
    attractionId: "eyJ1ZmkiOjIwMDg4MzI1fQ==",
  },
  {
    value: "SFO.AIRPORT",
    label: "San Francisco (SFO)",
    cityId: "20015732",
    attractionId: "eyJ1ZmkiOjIwMDE1NzMyfQ==",
  },
  {
    value: "SEA.AIRPORT",
    label: "Seattle (SEA)",
    cityId: "20144883",
    attractionId: "eyJ1ZmkiOjIwMTQ0ODgzfQ==",
  },
  {
    value: "LAS.AIRPORT",
    label: "Las Vegas (LAS)",
    cityId: "20079110",
    attractionId: "eyJ1ZmkiOjIwMDc5MTEwfQ==",
  },
  {
    value: "MCO.AIRPORT",
    label: "Orlando (MCO)",
    cityId: "20023488",
    attractionId: "eyJ1ZmkiOjIwMDIzNDg4fQ==",
  },
  {
    value: "FSD.AIRPORT",
    label: "Sioux Falls (FSD)",
    cityId: "20120053",
    attractionId: "eyJ1ZmkiOjIwMTIwMDUzfQ==",
  },
] as const;

export const FLIGHT_TIMES = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const;

export const HOTEL_PRICE_RANGES = [
  { value: "budget", label: "Budget-friendly" },
  { value: "moderate", label: "Moderately priced" },
  { value: "luxury", label: "Luxury" },
] as const;

export const INTERESTS = [
  { value: "museums", label: "Museums & Culture" },
  { value: "sports", label: "Sports & Recreation" },
  { value: "nightlife", label: "Nightlife & Entertainment" },
  { value: "food", label: "Food & Dining" },
  { value: "shopping", label: "Shopping" },
  { value: "nature", label: "Nature & Outdoors" },
  { value: "history", label: "Historical Sites" },
] as const;

type Leg = {
  carriersData: [{ name: string }];
  flightInfo: {
    carrierInfo: { marketingCarrier: string };
    flightNumber: string;
  };
};
// API Response Interfaces
export interface FlightApiResponse {
  segments: [
    {
      legs: Array<Leg>;
      departureAirport: { code: string; cityName: string };
      arrivalAirport: { code: string; cityName: string };
      departureTime: string;
      arrivalTime: string;
      totalTime: number;
    },
  ];
  priceBreakdown: {
    total: { units: number; nanos: number };
  };
}

export interface HotelApiResponse {
  property: {
    name: string;
    wishlistName: string;
    latitude: number;
    longitude: number;
    reviewScore: number;
    priceBreakdown: { grossPrice: { value: number } };
    photoUrls: string[];
  };
  accessibilityLabel: string;
}

export interface AttractionApiResponse {
  id: string;
  name: string;
  shortDescription: string;
  representativePrice?: { publicAmount: number };
  primaryPhoto?: { small: string };
  ufiDetails?: { bCityName: string };
  duration?: string;
  reviewsStats?: {
    combinedNumericStats?: { average: number };
    allReviewsCount: number;
  };
  cancellationPolicy?: { hasFreeCancellation: boolean };
}

// Domain Interfaces
export interface Flight {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureCity: string;
  departureTime: Date;
  arrivalAirport: string;
  arrivalCity: string;
  arrivalTime: Date;
  duration: string;
  price: number;

  legs: Array<{
    departureAirport: { code: string; cityName: string };
    arrivalAirport: { code: string; cityName: string };
    departureTime: Date;
    arrivalTime: Date;
    duration: string;
  }>;
}

export interface Hotel {
  id: string;
  name: string;
  location: string;
  address: string;
  rating: number;
  pricePerNight: number;
  imageUrl: string;
  description: string;
  amenities: string[];

  reviewScore: number;
}

export interface Attraction {
  id: string;
  name: string;
  description: string;
  price?: number;
  imageUrl: string;
  location?: string;
  duration?: string;
  rating?: number;
  reviewCount?: number;
  hasFreeCancellation: boolean;
}

export interface AirbnbLocation {
  id: string;
  location_name: string;
  terms: {
    offset: number;
    value: string;
  }[];
  country_code: string;
  countryCode: string;
  display_name: string;
  display_style: string;
}

export interface AirbnbPlace {
  avgRating: number;
  bathrooms: number;
  bedrooms: number;
  beds: number;
  city: string;
  roomType: string;
  summary: string;
  title: string;
  price: string;
  adults: number;
  images: string[];
  publicAddress: string;
}
