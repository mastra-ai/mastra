'use server';

import { mastra } from '@/mastra';

export async function submitTravelForm(formData: FormData) {
  // Convert FormData to a regular object for logging
  const formObject: Record<string, any> = {};
  formData.forEach((value, key) => {
    formObject[key] = value;
  });

  console.log('Travel Form Submission:', formObject);
  // Travel Form Submission: {
  //   departureLocation: 'ATL',
  //   arrivalLocation: 'LAX',
  //   tripGoals: 'To have a great time',
  //   preferredFlightTimes: 'afternoon',
  //   flightPriority: '76',
  //   accommodationType: 'hotel',
  //   hotelPriceRange: 'budget',
  //   interests: 'nightlife'
  // }

  const agent = mastra.getAgent('travel-agent');

  //
  //const result = await agent.text(formObject);

  return {
    message: 'Form submitted successfully!',
  };
}
