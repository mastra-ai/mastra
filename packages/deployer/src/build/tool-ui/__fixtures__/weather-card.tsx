import { useState } from 'react';
import { formatTemperature } from './format';

export function WeatherCard({ output }: { output?: { temperature: number } }) {
  const [unit] = useState('C');
  return <div data-testid="weather-card">{formatTemperature(output?.temperature, unit)}</div>;
}

export default function DefaultCard() {
  return <span>default</span>;
}
