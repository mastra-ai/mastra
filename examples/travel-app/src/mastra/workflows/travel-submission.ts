import { Step, Workflow } from '@mastra/core';
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
  choiceCount,
}: {
  choiceCount: string;
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
    action: async ({ data: { travelForm, userId, sessionId }, runId }) => {
      const items = await booking[method]({
        startDate: travelForm.startDate,
        endDate: travelForm.endDate,
        origin: travelForm[originId],
        destination: travelForm[destinationId],
      });

      if (!items || items?.length === 0) {
        return {
          [`${type}Selection`]: {
            ids: [],
            reasoning: `No ${type}s available`,
          },
        };
      }

      const agent = mastra.getAgent('travel-analyzer');
      const messages = [
        `
                Available ${type}s: ${JSON.stringify(items)}

                Here is the information about the customer's trip requirements: ${JSON.stringify(travelForm)}.
                
                Only make a unique ${choiceCount} selection for ${type}.

                Other Notes: 
                    - flightPriority is a value between 0 and 100 where 0 means the prioritize price the most and 100 means 
                    prioritize convenience the most (shortest trip and matching time).
                    - ALWAYS pass entire date timestamps back for departureTime and arrivalTime.
                `,
      ];

      try {
        const result = await agent.textObject({
          messages,
          runId,
          threadId: sessionId,
          resourceid: `travel-workflow-${userId}`,
          structuredOutput: z.object({
            ids: z.array(z.string()),
            reasoning: z.string(),
          }),
        });

        const typeSelection = items?.filter((item: any) => {
          return result?.object?.ids?.includes(item?.id || item?.flightNumber);
        });
        console.log(type, typeSelection);
        return {
          [`${type}Selection`]: {
            typeSelection,
            ...result.object,
          },
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
  choiceCount: '1',
});

const arrangeHotels = createArrangementStep({
  type: 'hotel',
  method: 'getHotels',
  originId: 'departureCityId',
  destinationId: 'arrivalCityId',
  choiceCount: '3',
});

const arrangeAttractions = createArrangementStep({
  type: 'attraction',
  method: 'getAttractions',
  originId: 'departureCityId',
  destinationId: 'arrivalCityId',
  choiceCount: '3',
});

export const workflow = new Workflow({
  name: 'Travel Submission',
  triggerSchema: z.object({
    userId: z.string(),
    sessionId: z.string(),
    travelForm: triggerSchema,
  }),
}).commit();

workflow
  .step(arrangeFlights, {
    variables: {
      sessionId: {
        step: 'trigger',
        path: 'sessionId',
      },
      userId: {
        step: 'trigger',
        path: 'userId',
      },
      travelForm: {
        step: 'trigger',
        path: 'travelForm',
      },
    },
  })
  .step(arrangeHotels, {
    variables: {
      sessionId: {
        step: 'trigger',
        path: 'sessionId',
      },
      userId: {
        step: 'trigger',
        path: 'userId',
      },
      travelForm: {
        step: 'trigger',
        path: 'travelForm',
      },
    },
  })
  .step(arrangeAttractions, {
    variables: {
      sessionId: {
        step: 'trigger',
        path: 'sessionId',
      },
      userId: {
        step: 'trigger',
        path: 'userId',
      },
      travelForm: {
        step: 'trigger',
        path: 'travelForm',
      },
    },
  });
