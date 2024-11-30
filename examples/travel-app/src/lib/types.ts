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

export const MAJOR_AIRPORTS = [
  { value: 'ATL', label: 'Atlanta (ATL)' },
  { value: 'LAX', label: 'Los Angeles (LAX)' },
  { value: 'ORD', label: 'Chicago (ORD)' },
  { value: 'DFW', label: 'Dallas/Fort Worth (DFW)' },
  { value: 'DEN', label: 'Denver (DEN)' },
  { value: 'JFK', label: 'New York (JFK)' },
  { value: 'SFO', label: 'San Francisco (SFO)' },
  { value: 'SEA', label: 'Seattle (SEA)' },
  { value: 'LAS', label: 'Las Vegas (LAS)' },
  { value: 'MCO', label: 'Orlando (MCO)' },
] as const;

export const FLIGHT_TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
] as const;

export const HOTEL_PRICE_RANGES = [
  { value: 'budget', label: 'Budget-friendly' },
  { value: 'moderate', label: 'Moderately priced' },
  { value: 'luxury', label: 'Luxury' },
] as const;

export const INTERESTS = [
  { value: 'museums', label: 'Museums & Culture' },
  { value: 'sports', label: 'Sports & Recreation' },
  { value: 'nightlife', label: 'Nightlife & Entertainment' },
  { value: 'food', label: 'Food & Dining' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'nature', label: 'Nature & Outdoors' },
  { value: 'history', label: 'Historical Sites' },
] as const;
