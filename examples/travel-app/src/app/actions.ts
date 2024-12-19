"use server";

import { randomUUID } from "crypto";

import { PLACES } from "@/lib/types";

import { mastra } from "@/mastra";
import { workflow } from "@/mastra/workflows/travel-submission";

import { travelSchema } from "./utils";

function processFormData(formData: FormData) {
  // Convert FormData to a regular object for logging
  const formObject: Record<string, any> = {};
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

  return formObject;
}

export async function runWorkflow({
  userId,
  formData,
}: {
  userId: string;
  formData: FormData;
}) {
  const formObject = processFormData(formData);

  const result = await workflow.execute({
    triggerData: {
      userId,
      sessionId: randomUUID(),
      travelForm: {
        departureLocation: formObject.departureLocation,
        arrivalLocation: formObject.arrivalLocation,
        tripGoals: formObject.tripGoals,
        preferredFlightTimes: formObject.preferredFlightTimes,
        flightPriority: formObject.flightPriority,
        accommodationType: formObject.accommodationType,
        hotelPriceRange: formObject.hotelPriceRange,
        interests: formObject.interests,
        startDate: formObject.startDate,
        endDate: formObject.endDate,
        departureCityId: formObject.departureCityId,
        arrivalCityId: formObject.arrivalCityId,
        arrivalAttractionId: formObject.arrivalAttractionId,
      },
    },
  });

  return result;
}

export async function runAgent(formData: FormData) {
  const formObject = processFormData(formData);

  const agent = mastra.getAgent("travelAgent");

  const toolsPrompt = `
    You are a travel agent and have been given the following information about a customer's trip requirements.
    You will need to complete the following tasks:

    - Find the best flight option for the customer (use departureLocation and arrivalLocation from formObject)
    - Find the best accommodation option for the customer (use arrivalCityId from formObject)
    - Find three activities and attractions for the customer based on their interests (use arrivalAttractionId from formObject)
    - Find the best flight option for the customer to return home (use departureLocation and arrivalLocation from formObject)

    Other Notes:

    - flightPriority is a value between 0 and 100 where 0 means the prioritize price the most and 100 means
    prioritize convenience the most (shortest trip and matching time).
    - ALWAYS pass entire date timestamps back for departureTime and arrivalTime.
    - ALWAYS pass the entire flight object back for the outbound and return flights.
  
    Here is the information about the customer's trip requirements:
    ${JSON.stringify(formObject)}
  `;

  const toolResult = await agent.generate(toolsPrompt);

  console.log("tool resulttt=======", toolResult);

  const prompt = `
    You are a travel agent and after doing your research you have found the following information for the customer's trip.

    Use this information to format the response in the correct output schema so it can be used by your travel planner application.

     IMPORTANT: For hotel ratings:
    - IGNORE the reviewScore property
    - Instead, find and extract the numeric rating from the description or accessibilityLabel field
    - The rating will be in the format "X.X out of 5 stars" or "X out of 5 stars"
    - Extract ONLY the first number (before "out of")
    - The extracted rating must be less than or equal to 5

    Example:
    If description contains "4.5 out of 5 stars" → return rating: 4.5
    If description contains "3 out of 5 stars" → return rating: 3

    IMPORTANT 2: for layover
    - Do not hallucinate layover information
    - If you don't have it supplied, ignore it
    - If not, make sure you add it in


    ${JSON.stringify(toolResult)}
  `;

  const result = await agent.generate(prompt, {
    schema: travelSchema,
  });

  console.log("Travel Agent Result:", result.object);

  return {
    message: result.object,
  };
}
