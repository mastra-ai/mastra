'use server';

import { workflow } from '@/mastra/workflows/travel-submission';

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

  // const agent = mastra.

  const result = await workflow.execute({
    travelForm: {
      departureLocation: 'SEA.AIRPORT',
      arrivalLocation: 'LAS.AIRPORT',
      tripGoals: 'Have fun in Vegas!',
      preferredFlightTimes: 'morning',
      flightPriority: '1',
      accommodationType: 'hotel',
      hotelPriceRange: 'budget',
      interests: 'nightlife',
      startDate: '2024-12-09',
      endDate: '2024-12-18',
      departureCityId: '20144883',
      arrivalCityId: '20079110',
      arrivalAttractionId: 'eyJ1ZmkiOjIwMDc5MTEwfQ==',
    },
  });

  console.log(JSON.stringify(result, null, 2));

  //
  //const result = await agent.text(formObject);

  return {
    message: 'Form submitted successfully!',
  };
}
