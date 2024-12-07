import CodeBlock from '@/components/code-block';
import Footer from '@/components/footer';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';

import { SidebarProvider } from '@/lib/sidebar-context';

import TravelForm from '../travel-form';

export default function Page() {
  const sidebarContent = {
    initial: (
      <>
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <p className="mb-4">
          This travel planner uses a Mastra workflow and LLM calls to help plan your trip. Here&apos;s how the code
          works:
        </p>

        <h3 className="text-lg font-semibold mb-2">1. Assemble Agent</h3>
        <p className="mb-2">
          The agent is is defined with a name, a set of instructions, and a model. This agent is not provided any tools
          and is just responsible for making calls to the LLM.
        </p>
        <CodeBlock
          fileName="src/mastra/agents/index.ts"
          language="typescript"
          code={`import { Agent } from '@mastra/core';

export const travelAnalyzer = new Agent({
  name: 'travel-analyzer',
  instructions:
    'You are an expert travel agent responsible for finding a flight, hotel, and three attractions for a user. You will be given a set of user preferences along with some data to find the best options for them.',
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20240620',
    toolChoice: 'auto',
  },
});`}
        />

        <h3 className="text-lg font-semibold mt-6 mb-2">2. Create Workflow</h3>
        <p className="mb-2">
          A Mastra workflow allows you to break down a complex process into more deterministic steps. In this code we
          create a workflow that parallelizes finding flights, hotels, and attractions. We start by defining a schema
          for the data that will be passed to the workflow.
        </p>
        <CodeBlock
          fileName="mastra/workflows/travel-submission.ts"
          language="typescript"
          code={`const triggerSchema = z.object({
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
`}
        />
        <p className="mb-2 mt-2">More info goes here...</p>
      </>
    ),
    submitted: (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">How the Form Submission Works</h2>
        <p className="mb-4">Once the form is submitted, the data is passed to the agent with a detailed prompt...</p>
      </div>
    ),
  };

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex flex-1">
          <main className="flex-1 bg-gray-50">
            <div className="container mx-auto px-4 py-8">
              <h1 className="text-4xl font-bold text-center">Travel Planner</h1>
              <h2 className="text-xl font-bold text-center mb-4">Workflow example</h2>
              <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8">
                This example uses a Mastra workflow to help plan a trip. Rather than relying on the Agent to make the
                decision on what tools to call, a workflow breaks the process into more deterministic steps.
              </p>
              <TravelForm executor="workflow" sidebarContent={sidebarContent} />
            </div>
          </main>
          <Sidebar />
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
