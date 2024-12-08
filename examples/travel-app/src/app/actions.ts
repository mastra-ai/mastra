'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';

import { PLACES } from '@/lib/types';

import { mastra } from '@/mastra';
import { workflow } from '@/mastra/workflows/travel-submission';

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
  const formObject = processFormData(formData);
  // const formObject = {
  //   departureLocation: 'LAX.AIRPORT',
  //   arrivalLocation: 'JFK.AIRPORT',
  //   tripGoals: 'Have fun!',
  //   preferredFlightTimes: 'morning',
  //   flightPriority: '100',
  //   accommodationType: 'hotel',
  //   hotelPriceRange: 'luxury',
  //   interests: 'food',
  //   startDate: '2024-12-07',
  //   endDate: '2024-12-20',
  //   departureCityId: '20033173',
  //   arrivalCityId: '20088325',
  //   arrivalAttractionId: 'eyJ1ZmkiOjIwMDg4MzI1fQ=='
  // }

  const result = await workflow.execute({
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
  });

  return result;
}

export async function runAgent(formData: FormData) {
  const formObject = processFormData(formData);
  console.log(formObject);

  const agent = mastra.getAgent('travel-agent');

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

  const toolResult = await agent.text({
    messages: [toolsPrompt],
  });

  console.log('Tool Result:', toolResult);

  const prompt = `
    You are a travel agent and after doing your research you have found the following information for the customer's trip.

    Use this information to format the response in the correct output schema so it can be used by your travel planner application.

    ${JSON.stringify(toolResult)}
  `;

  const result = await agent.textObject({
    messages: [prompt],
    structuredOutput: {
      flight: {
        type: 'object',
        items: {
          airline: { type: 'string' },
          flightNumber: { type: 'string' },
          departureTime: { type: 'string' },
          arrivalTime: { type: 'string' },
          duration: { type: 'string' },
          price: { type: 'number' },
          stops: { type: 'number' },
          departureAirport: { type: 'string' },
          arrivalAirport: { type: 'string' },
          departureCity: { type: 'string' },
          arrivalCity: { type: 'string' },
        },
      },
      hotel: {
        type: 'object',
        items: {
          name: { type: 'string' },
          rating: { type: 'number' },
          pricePerNight: { type: 'number' },
          location: { type: 'string' },
          address: { type: 'string' },
          description: { type: 'string' },
          amenities: { type: 'array', items: { type: 'string' } },
          imageUrl: { type: 'string' },
          phoneNumber: { type: 'string' },
        },
      },
      attractions: {
        type: 'array',
        items: {
          type: 'object',
          items: {
            name: { type: 'string' },
            description: { type: 'string' },
            rating: { type: 'number' },
            price: { type: 'number' },
            imageUrl: { type: 'string' },
            location: { type: 'string' },
          },
        },
      },
    },
  });

  console.log('Travel Agent Result:', result);

  return {
    message: result.object,
  };
}
