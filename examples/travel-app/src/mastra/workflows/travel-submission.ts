import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";

import { mastra } from "../index";
import { Booking } from "../integrations/Booking";

const booking = new Booking({
  token: process.env.RAPID_API_KEY || "",
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
  typeOfPlace: z.string().optional(),
});

function createArrangementStep({
  type,
  method,
  originId,
  destinationId,
  choiceCount,
}: {
  choiceCount: string;
  originId:
    | "departureLocation"
    | "departureCityId"
    | "arrivalLocation"
    | "arrivalCityId";
  destinationId:
    | "arrivalLocation"
    | "arrivalCityId"
    | "departureLocation"
    | "departureCityId";
  method:
    | "getFlights"
    | "getHotels"
    | "getAttractions"
    | "getAirbnb"
    | "getAirbnbSearchPlaces";
  type:
    | "outboundFlight"
    | "returnFlight"
    | "accommodation"
    | "attraction"
    | "airbnb"
    | "airbnbLocation";
}) {
  return new Step({
    id: type,
    inputSchema: z.object({
      userId: z.string(),
      sessionId: z.string(),
      travelForm: triggerSchema,
    }),
    outputSchema: z.object({
      [`${type}Selection`]: z.object({
        ids: z.array(z.string()),
        reasoning: z.string(),
      }),
    }),
    execute: async ({
      context: { travelForm, userId, sessionId, steps },
      runId,
    }) => {
      const items = await booking[method]({
        startDate: travelForm.startDate,
        endDate: travelForm.endDate,
        origin: travelForm[originId],
        destination: travelForm[destinationId],
        typeOfPlace: travelForm.typeOfPlace || "",
        checkIn: travelForm.startDate,
        checkOut: travelForm.endDate,
        placeId: travelForm.arrivalAttractionId,
        place: travelForm.arrivalAttractionId,
        payload:
          steps.airbnbLocationSelection.status === "success"
            ? steps.airbnbLocationSelection.output
            : undefined,
      });

      if (!items || items?.length === 0) {
        return {
          [`${type}Selection`]: {
            ids: [],
            reasoning: `No ${type}s available`,
          },
        };
      }

      const agent = mastra.getAgent("travelAnalyzer");
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
        const result = await agent.generate(messages, {
          runId,
          threadId: sessionId,
          resourceId: `travel-workflow-${userId}`,
          output: z.object({
            ids: z.array(z.string()),
            reasoning: z.string(),
          }),
        });

        const typeSelection = items?.filter((item: Record<string, unknown>) => {
          return result?.object?.ids?.includes(
            (item?.id as string) || (item?.flightNumber as string),
          );
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

const outboundFlight = createArrangementStep({
  type: "outboundFlight",
  method: "getFlights",
  originId: "departureLocation",
  destinationId: "arrivalLocation",
  choiceCount: "1",
});

const returnFlight = createArrangementStep({
  type: "returnFlight",
  method: "getFlights",
  originId: "arrivalLocation",
  destinationId: "departureLocation",
  choiceCount: "1",
});

const arrangeHotels = createArrangementStep({
  type: "accommodation",
  method: "getHotels",
  originId: "departureCityId",
  destinationId: "arrivalCityId",
  choiceCount: "3",
});

const getAirbnbLocation = createArrangementStep({
  type: "airbnbLocation",
  method: "getAirbnbSearchPlaces",
  originId: "departureCityId",
  destinationId: "arrivalCityId",
  choiceCount: "3",
});

const arrangeAirbnb = createArrangementStep({
  type: "accommodation",
  method: "getAirbnb",
  originId: "departureCityId",
  destinationId: "arrivalCityId",
  choiceCount: "3",
});

const arrangeAttractions = createArrangementStep({
  type: "attraction",
  method: "getAttractions",
  originId: "departureCityId",
  destinationId: "arrivalCityId",
  choiceCount: "3",
});

export const workflow = new Workflow({
  name: "Travel Submission",
  triggerSchema: z.object({
    userId: z.string(),
    sessionId: z.string(),
    travelForm: triggerSchema,
  }),
});

workflow
  .step(outboundFlight, {
    variables: {
      sessionId: {
        step: "trigger",
        path: "sessionId",
      },
      userId: {
        step: "trigger",
        path: "userId",
      },
      travelForm: {
        step: "trigger",
        path: "travelForm",
      },
    },
  })
  .step(returnFlight, {
    variables: {
      sessionId: {
        step: "trigger",
        path: "sessionId",
      },
      userId: {
        step: "trigger",
        path: "userId",
      },
      travelForm: {
        step: "trigger",
        path: "travelForm",
      },
    },
  })
  .step(arrangeHotels, {
    variables: {
      sessionId: {
        step: "trigger",
        path: "sessionId",
      },
      userId: {
        step: "trigger",
        path: "userId",
      },
      travelForm: {
        step: "trigger",
        path: "travelForm",
      },
    },
    when: {
      ref: { step: "trigger", path: "travelForm.accommodationType" },
      query: { $eq: "hotel" },
    },
  })
  .step(arrangeAttractions, {
    variables: {
      sessionId: {
        step: "trigger",
        path: "sessionId",
      },
      userId: {
        step: "trigger",
        path: "userId",
      },
      travelForm: {
        step: "trigger",
        path: "travelForm",
      },
    },
  })
  .step(getAirbnbLocation, {
    variables: {
      sessionId: {
        step: "trigger",
        path: "sessionId",
      },
      userId: {
        step: "trigger",
        path: "userId",
      },
      travelForm: {
        step: "trigger",
        path: "travelForm",
      },
    },
    when: {
      ref: { step: "trigger", path: "travelForm.accommodationType" },
      query: { $eq: "airbnb" },
    },
  })
  .then(arrangeAirbnb, {
    variables: {
      travelForm: {
        step: "trigger",
        path: "travelForm",
      },
    },
  })
  .commit();
