import Link from 'next/link';

import Footer from '@/components/footer';
import Header from '@/components/header';
import Sidebar from '@/components/sidebar';

import { SidebarProvider } from '@/lib/sidebar-context';

import TravelForm from './travel-form';

export default function Page() {
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
              <TravelForm />
            </div>
          </main>
          <Sidebar />
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
