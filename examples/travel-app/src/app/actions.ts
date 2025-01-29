"use server";

import { PLACES } from "@/lib/types";

import { mastra } from "@/mastra";

import { z } from "zod";
import { travelSchema } from "./utils";

const tripDataSchema = z.object({
  departureLocation: z.string().min(1, "Departure location is required"),
  arrivalLocation: z.string().min(1, "Arrival location is required"),
  tripGoals: z.string(),
  preferredFlightTimes: z.string(),
  flightPriority: z
    .string()
    .regex(/^\d{1,3}$/, "Flight priority must be a number between 0 and 100"),
  accommodationType: z.enum(["hotel", "airbnb"]),
  hotelPriceRange: z.enum(["budget", "moderate", "luxury"]).optional(),
  interests: z.string(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  departureCityId: z.string().min(1, "Departure city ID is required"),
  arrivalCityId: z.string().min(1, "Arrival city ID is required"),
  arrivalAttractionId: z.string(),
  typeOfPlace: z
    .enum(["Entire home/apt", "Private room", "Shared room"])
    .optional(),
});

function processFormData(formData: FormData) {
  // Convert FormData to a regular object for logging
  const formObject: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    formObject[key] = value;
  });
  // Look up cityIds for departure and arrival locations
  const departurePlace = PLACES.find(
    (place) => place.value === formObject.departureLocation,
  );
  const arrivalPlace = PLACES.find(
    (place) => place.value === formObject.arrivalLocation,
  );

  // Add ids to the form object
  formObject.departureCityId = departurePlace?.cityId;
  formObject.arrivalCityId = arrivalPlace?.cityId;
  formObject.arrivalAttractionId = arrivalPlace?.attractionId;

  const parsedData = tripDataSchema.parse(formObject);

  return parsedData;
}

export async function runAgent(formData: FormData) {
  const formObject = processFormData(formData);

  const travelAgent = mastra.getAgent("travelAgent");
  const travelAnalyzer = mastra.getAgent("travelAnalyzer");

  const message = `
    You are a travel agent and have been given the following information about a customer's trip requirements.

    - Find the best flight option for the customer (use departureLocation and arrivalLocation from formObject)
    - Find the best accommodation option for the customer (use arrivalCityId from formObject)
    - Find three activities and attractions for the customer based on their interests (use arrivalAttractionId from formObject)
    - Find the best flight option for the customer to return home (use departureLocation and arrivalLocation from formObject)
    - Find the best Airbnb option for the customer to stay (use arrivalCityId from formObject) and pass it in to the searchAirbnbLocation tool
    - After you have found the Airbnb location, call the searchAirbnb tool (use the id from the searchAirbnbLocation tool, and use typeOfPlace, startDate and endDate from formObject)

    Other Notes:
    - make sure to add layover information if it exists, if not, ignore it
    - make sure to add images for the hotels and accomodations
    - flightPriority is a value between 0 and 100 where 0 means the prioritize price the most and 100 means
    prioritize convenience the most (shortest trip and matching time).
    - ALWAYS pass entire date timestamps back for departureTime and arrivalTime.
    - ALWAYS pass the entire flight object back for the outbound and return flights.
    - You must not call the searchAirbnbLocation and searchAirbnb tools if the accommodationType is hotel.
    - You must not call the searchHotels tool if the accommodationType is Airbnb.

    Here is the information about the customer's trip requirements:

    Departure Location: ${formObject.departureLocation}
    Arrival Location: ${formObject.arrivalLocation}
    Trip Goals: ${formObject.tripGoals}
    Preferred Flight Times: ${formObject.preferredFlightTimes}
    Flight Priority: ${formObject.flightPriority}
    Accommodation Type: ${formObject.accommodationType}
    Hotel Price Range: ${formObject.hotelPriceRange}
    Interests: ${formObject.interests}
    Start Date: ${formObject.startDate}
    End Date: ${formObject.endDate}
    Departure City ID: ${formObject.departureCityId}
    Arrival City ID: ${formObject.arrivalCityId}
    Arrival Attraction ID: ${formObject.arrivalAttractionId}
    Type of Place: ${formObject.typeOfPlace}
  `;

  const agentResult = await travelAgent.generate(message);

  console.log("from travelAgent", agentResult.usage);

  const data = agentResult.steps.map((step) => step.text);

  console.log("data from travelAgent=======", data);

  const messageToAnalyze = `
    You are a travel agent and after doing your research you have found the following information for the customer's trip.

    Use this information to format the response in the correct output schema so it can be used by your travel planner application.

   IMPORTANT: For hotel ratings:
    - IGNORE the reviewScore property
    - Instead, find and extract the numeric rating from the description or accessibilityLabel field
    - The rating will be in the format "X.X out of 5 stars" or "X out of 5 stars"
    - Extract ONLY the first number (before "out of")
    - The extracted rating must be less than or equal to 5
    - Add layover information in the legs

    Example:
    If description contains "4.5 out of 5 stars" → return rating: 4.5
    If description contains "3 out of 5 stars" → return rating: 3

    IMPORTANT: for <UKNOWN> values:
    - make sure to replace all instances of <UNKNOWN> with empty strings
    ${JSON.stringify(data)}
  `;

  const result = await travelAnalyzer.generate(messageToAnalyze, {
    output: travelSchema,
  });

  console.log("from travelAnalyzer", result.usage);

  console.log("Travel Agent Result:", result.object);

  return {
    message: result.object,
  };
}
