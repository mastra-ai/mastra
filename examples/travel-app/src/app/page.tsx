import Link from 'next/link';

import CodeBlock from '@/components/code-block';
import Footer from '@/components/footer';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';

import { SidebarProvider } from '@/lib/sidebar-context';

import TravelForm from './travel-form';

export default function Page() {
  const sidebarContent = {
    initial: (
      <>
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <p className="mb-4">This travel planner uses AI agents to help plan your trip. Here's how the code works:</p>

        <h3 className="text-lg font-semibold mb-2">1. Form Submission</h3>
        <p className="mb-2">When you submit the form, the data is processed using a server action:</p>
        <CodeBlock
          fileName="app/actions.ts"
          language="typescript"
          code={`async function planTrip(formData: TripFormData) {
  const agent = new TravelAgent();
  const result = await agent.execute({
    destination: formData.destination,
    dates: formData.dates,
    budget: formData.budget
  });
  return result;
}`}
        />

        <h3 className="text-lg font-semibold mt-6 mb-2">2. AI Agent Processing</h3>
        <p className="mb-2">The AI agent uses various tools to gather travel information:</p>
        <CodeBlock
          fileName="mastra/agents/index.ts"
          language="typescript"
          code={`class TravelAgent extends Agent {
  tools = [
    new SearchHotels(),
    new SearchAttractions(),
    new GetWeather()
  ];

  async execute(input: TripInput) {
    // Agent processes the request and uses
    // tools to gather information
    return this.process(input);
  }
}`}
        />

        <h3 className="text-lg font-semibold mt-6 mb-2">3. Results Display</h3>
        <p className="mb-2">The results are rendered using React components:</p>
        <CodeBlock
          fileName="app/travel-results.tsx"
          language="typescript"
          code={`export function TravelResults({ results }) {
    return (
      <div className="grid gap-4">
        <HotelResults hotels={results.hotels} />
        <AttractionResults attractions={results.attractions} />
        <WeatherInfo weather={results.weather} />
      </div>
    );
  }`}
        />
      </>
    ),
    submitted: (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Trip Summary</h2>
        <p className="mb-4">Here's what we've planned for your trip:</p>
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
              <h2 className="text-xl font-bold text-center mb-4">Agent example</h2>
              <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8">
                This example uses a simple Mastra agent to help plan a trip. It provides tools (API calls) for the agent
                to use to help plan the trip and allows the agent to decide what tool calls to use. Allowing the agent
                to make decisions can lead to less deterministic results. Check out the{' '}
                <Link className="text-blue-500" href="/workflow">
                  Workflow example
                </Link>{' '}
                for another alternative for building the same type of application in a more deterministic manner.
              </p>
              <TravelForm sidebarContent={sidebarContent} />
            </div>
          </main>
          <Sidebar />
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
