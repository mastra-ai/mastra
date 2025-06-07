import { WeatherForm } from './components/WeatherForm';

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="weather-card">
        <h2 className="text-xl font-semibold mb-4">Ask About the Weather</h2>
        <p className="text-gray-600 mb-4">
          Enter a location to get current weather information powered by Mastra AI.
        </p>
        <WeatherForm />
      </section>
      
      <section className="weather-card">
        <h2 className="text-xl font-semibold mb-4">About This Template</h2>
        <p className="text-gray-600 mb-4">
          This is a starter template showing how to integrate Mastra directly into your Next.js application. 
          It demonstrates:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-gray-600">
          <li>Direct Mastra integration in Next.js</li>
          <li>Using Server Actions with Mastra</li>
          <li>Building a simple AI-powered weather interface</li>
          <li>Proper project organization for Mastra agents and tools</li>
        </ul>
      </section>
    </div>
  );
}
