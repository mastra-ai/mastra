'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';

import { PLACES } from '@/lib/types';

import { mastra } from '@/mastra';
import { workflow } from '@/mastra/workflows/travel-submission';

const flightSchema = z.object({
  airline: z.string(),
  flightNumber: z.string(),
  departureTime: z.string(),
  arrivalTime: z.string(),
  duration: z.string(),
  price: z.number(),
  stops: z.number(),
  departureAirport: z.string(),
  arrivalAirport: z.string(),
  departureCity: z.string(),
  arrivalCity: z.string(),
});

const hotelSchema = z.object({
  name: z.string(),
  rating: z.number(),
  pricePerNight: z.number(),
  location: z.string(),
  address: z.string(),
  description: z.string(),
  amenities: z.array(z.string()),
  imageUrl: z.string(),
  phoneNumber: z.string(),
});

const attractionsSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    rating: z.number(),
    price: z.number(),
    imageUrl: z.string(),
    location: z.string(),
  }),
);

const travelSchema = z.object({
  flight: flightSchema,
  hotel: hotelSchema,
  attractions: attractionsSchema,
});

function processFormData(formData: FormData) {
  // Convert FormData to a regular object for logging
  const formObject: Record<string, any> = {};
  formData.forEach((value, key) => {
    formObject[key] = value;
  });

  // Look up cityIds for departure and arrival locations
  const departurePlace = PLACES.find(place => place.value === formObject.departureLocation);
  const arrivalPlace = PLACES.find(place => place.value === formObject.arrivalLocation);

  // Add ids to the form object
  formObject.departureCityId = departurePlace?.cityId;
  formObject.arrivalCityId = arrivalPlace?.cityId;
  formObject.arrivalAttractionId = arrivalPlace?.attractionId;

  console.log('Travel Form Submission:', formObject);
  return formObject;
}

export async function runWorkflow({ userId, formData }: { userId: string; formData: FormData }) {
  console.log('========== from run workflow');
  const formObject = processFormData(formData);

  const result = await workflow.execute({
    triggerData: {
      userId,
      sessionId: randomUUID(),
      travelForm: {
        departureLocation: formObject.departureLocation,
        arrivalLocation: formObject.arrivalLocation,
        tripGoals: formObject.tripGoaxls,
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
  console.log('======= from runAgenttt');
  const formObject = processFormData(formData);
  console.log(formObject);

  const agent = mastra.getAgent('travelAgent');

  const toolsPrompt = `
    You are a travel agent and have been given the following information about a customer's trip requirements.
    You will need to complete the following tasks:

    - Find the best flight option for the customer (use departureLocation and arrivalLocation from formObject)
    - Find the best accommodation option for the customer (use arrivalCityId from formObject)
    - Find three activities and attractions for the customer based on their interests (use arrivalAttractionId from formObject)

    Other Notes: 
    
    - flightPriority is a value between 0 and 100 where 0 means the prioritize price the most and 100 means 
    prioritize convenience the most (shortest trip and matching time).
    - ALWAYS pass entire date timestamps back for departureTime and arrivalTime.

    Here is the information about the customer's trip requirements:
    ${JSON.stringify(formObject)}
  `;

  const toolResult = await agent.generate(toolsPrompt);

  console.log('Tool Result:', toolResult);

  const prompt = `
    You are a travel agent and after doing your research you have found the following information for the customer's trip.

    Use this information to format the response in the correct output schema so it can be used by your travel planner application.

    ${JSON.stringify(toolResult)}
  `;

  const result = await agent.generate(prompt, {
    schema: travelSchema,
  });

  console.log('Travel Agent Result:', result);

  return {
    message: result.object,
  };
}
