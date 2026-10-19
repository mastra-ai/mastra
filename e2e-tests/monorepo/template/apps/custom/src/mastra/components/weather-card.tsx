import { useState } from 'react';

interface WeatherCardProps {
  input?: { city: string };
  output?: { temperature: number };
}

export function WeatherCard({ input, output }: WeatherCardProps) {
  const [unit] = useState('C');
  return (
    <section data-marker="weather-card-studio-marker">
      {input?.city}: {output?.temperature}°{unit}
    </section>
  );
}
