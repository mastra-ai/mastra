import CodeBlock from "@/components/code-block";
import Footer from "@/components/footer";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";

import { SidebarProvider } from "@/lib/sidebar-context";

import TravelForm from "./travel-form";

export default function Page() {
  const sidebarContent = {
    initial: (
      <>
        <h1 className="inline-block bg-black text-white px-6 py-3 text-3xl font-mono font-bold mb-8 rotate-1">
          How It Works
        </h1>
        <p className="mb-4">
          This travel planner uses AI agents to help plan your trip. Here&apos;s
          how the code works:
        </p>

        <div className="bg-[var(--brut-pink)] p-4">
          <h3 className="inline-block bg-black text-white px-4 py-2 text-xl font-bold mb-6 -rotate-1">
            1. Assemble Agent
          </h3>
          <p className="mb-2">
            The agent is is defined with a name, a set of instructions, a model,
            and a collection of enabled tools:
          </p>
          <CodeBlock
            fileName="src/mastra/agents/index.ts"
            language="typescript"
            code={`import { Agent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';

export const travelAgent = new Agent({
  name: 'travelAgent',
  instructions:
    'You are an expert travel agent responsible for finding a flight, hotel,
    and three attractions for a user. You will be given a set of user
    preferences along with some tools and you will need to find the best
    options for them.',
  model: anthropic('claude-3-5-sonnet-20240620'),
  enabledTools: {
    searchFlights: true,
    searchHotels: true,
    searchAttractions: true,
  },
});`}
          />
        </div>

        <div className="bg-[var(--brut-green)] flex flex-col gap-4 mt-4 p-4">
          <h3 className="inline-block w-fit bg-black text-white px-4 py-2 text-xl font-bold mb-6 -rotate-1">
            2. Agent Tools
          </h3>
          <p className="mb-2 text-sm">
            Tools are just functions that can be used by the agent. You can
            define these functions and then enable them for any agent you
            create. These tools can also be used within workflows. Here is the
            code for the <code>searchFlights</code> tool
          </p>
          <CodeBlock
            fileName="mastra/agents/index.ts"
            language="typescript"
            code={`export const searchFlights = createTool({
  label: 'Get Flight Info',
  schema: z.object({
    startDate: z.string(),
    endDate: z.string(),
    origin: z.string(),
    destination: z.string(),
  }),
  description: 'Fetches flight information for a given date range, origin and destination',
  executor: async ({ data: { startDate, endDate, origin, destination } }) => {
    console.log('Using tool to fetch flight information: ', startDate, endDate, origin, destination);
    const flights = await getFlights(startDate, endDate, origin, destination);
    return {
      flights: flights as Flight[],
    };
  },
});
`}
          />
          <p className="mb-2 mt-2 text-sm">
            Note: The label and description of the tool are both important to
            help the model decide when to call the tool. It is also a good idea
            to pass in information in the Agent instructions that tells the
            model when certain tools should be used.
          </p>
          <p className="mb-2 text-sm">
            The getFlights function just makes a GET request to a flight search
            API and then pulls out only the data we want to pass back to the
            model.
          </p>
          <CodeBlock
            fileName="app/travel-results.tsx"
            language="typescript"
            code={`export const getFlights = async (startDate: string, endDate: string, origin: string, destination: string) => {
  const url = \`https://booking-com15.p.rapidapi.com/api/v1/flights/searchFlights?fromId=\${origin}&toId=\${destination}&departDate=\${startDate}&returnDate=\${endDate}&pageNo=1&adults=1&sort=BEST&cabinClass=ECONOMY&currency_code=USD\`;
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': process.env.RAPID_API_KEY || '',
      'x-rapidapi-host': 'booking-com15.p.rapidapi.com',
    },
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    return result?.data?.flightOffers.map(
      (flight: FlightApiResponse): Flight => ({
        airline: flight.segments[0].legs[0].carriersData[0].name,
        flightNumber: \`\${flight.segments[0].legs[0].flightInfo.carrierInfo.marketingCarrier}\${flight.segments[0].legs[0].flightInfo.flightNumber}\`,
        departureAirport: flight.segments[0].departureAirport.code,
        departureCity: flight.segments[0].departureAirport.cityName,
        departureTime: new Date(flight.segments[0].departureTime),
        arrivalAirport: flight.segments[0].arrivalAirport.code,
        arrivalCity: flight.segments[0].arrivalAirport.cityName,
        arrivalTime: new Date(flight.segments[0].arrivalTime),
        duration: \`\${Math.floor(flight.segments[0].totalTime / 60)}h \${flight.segments[0].totalTime % 60}m\`,
        price: flight.priceBreakdown.total.units + flight.priceBreakdown.total.nanos / 1000000000,
      }),
    );
  } catch (error) {
    console.error(error);
  }
};`}
          />
        </div>
      </>
    ),
    submitted: (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">How the Form Submission Works</h2>
        <p className="mb-4">
          Once the form is submitted, the data is passed to the agent with a
          detailed prompt...
        </p>
      </div>
    ),
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex  flex-1">
          <main className="flex-1 ">
            <div className="container mx-auto px-4 py-8">
              <div className="mb-12 text-center transform -rotate-1">
                <div className="inline-block bg-black text-white px-8 py-4 text-4xl md:text-6xl font-bold shadow-[8px_8px_0px_0px_#000000] transition-all">
                  TravelAI
                </div>
                <div className="mt-4 bg-[var(--brut-red)] text-white px-4 py-2 text-xl inline-block rotate-2 shadow-[4px_4px_0px_0px_#000000]">
                  Agent
                </div>
              </div>
              <TravelForm executor="agent" sidebarContent={sidebarContent} />
            </div>
          </main>
          <Sidebar />
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
