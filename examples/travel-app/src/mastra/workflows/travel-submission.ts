import { createLogger, Step, Workflow } from '@mastra/core';
import { z } from 'zod';

import { Booking } from '../integrations/Booking';

import { mastra } from '..';

const booking = new Booking({
  token: process.env.RAPID_API_KEY || '',
});

const triggerSchema = z.object({
  departureLocation: z.string(),
  arrivalLocation: z.string(),
  tripGoals: z.string(),
  preferredFlightTimes: z.string(),
  flightPriority: z.string(),
  accommodationType: z.string(),
  hotelPriceRange: z.string(),
  interests: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  departureCityId: z.string(),
  arrivalCityId: z.string(),
  arrivalAttractionId: z.string(),
});

function createArrangementStep({
  type,
  method,
  originId,
  destinationId,
}: {
  originId: 'departureLocation' | 'departureCityId';
  destinationId: 'arrivalLocation' | 'arrivalCityId';
  method: 'getFlights' | 'getHotels' | 'getAttractions';
  type: 'flight' | 'hotel' | 'attraction';
}) {
  return new Step({
    id: type,
    outputSchema: z.object({
      [`${type}Selection`]: z.object({
        ids: z.array(z.string()),
        reasoning: z.string(),
      }),
    }),
    action: async ({ data: { travelForm }, runId }) => {
      const items = await booking[method]({
        startDate: travelForm.startDate,
        endDate: travelForm.endDate,
        origin: travelForm[originId],
        destination: travelForm[destinationId],
      });

      const agent = mastra.getAgent('travel-analyzer');
      const messages = [
        `Possible ${type}s: ${JSON.stringify(items)}`,
        `Based on preferences here: ${JSON.stringify(travelForm)} which ${type} do you recommend?
                Return the ${type} ids in a json array and your reasoning in a string.
                `,
      ];

      try {
        const result = await agent.textObject({
          messages,
          runId,
          structuredOutput: z.object({
            ids: z.array(z.string()),
            reasoning: z.string(),
          }),
        });

        return {
          [`${type}Selection`]: result.object,
        };
      } catch (e) {
        console.error(e);
      }

      return {
        [`${type}Selection`]: {
          ids: [],
          reasoning: `No ${type}s available`,
        },
      };
    },
  });
}

const arrangeFlights = createArrangementStep({
  type: 'flight',
  method: 'getFlights',
  originId: 'departureLocation',
  destinationId: 'arrivalLocation',
});

const arrangeHotels = createArrangementStep({
  type: 'hotel',
  method: 'getHotels',
  originId: 'departureCityId',
  destinationId: 'arrivalCityId',
});

const arrangeAttractions = createArrangementStep({
  type: 'attraction',
  method: 'getAttractions',
  originId: 'departureCityId',
  destinationId: 'arrivalCityId',
});

export const workflow = new Workflow({
  name: 'Travel Submission',
  triggerSchema: z.object({
    travelForm: triggerSchema,
  }),
  steps: [arrangeFlights, arrangeAttractions, arrangeHotels],
  logger: createLogger({
    type: 'CONSOLE',
  }),
});

workflow
  .config('flight', {
    dependsOn: [],
    variables: {
      travelForm: {
        stepId: 'trigger',
        path: 'travelForm',
      },
    },
  })
  .config('hotel', {
    dependsOn: [],
    variables: {
      travelForm: {
        stepId: 'trigger',
        path: 'travelForm',
      },
    },
  })
  .config('attraction', {
    dependsOn: [],
    variables: {
      travelForm: {
        stepId: 'trigger',
        path: 'travelForm',
      },
    },
  });
