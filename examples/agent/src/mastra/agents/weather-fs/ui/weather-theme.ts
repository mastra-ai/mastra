export const SCENES = ['sunny', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy'] as const;

export type Scene = (typeof SCENES)[number];

export interface WeatherTheme {
  label: string;
  sky: string;
  shadow: string;
  cloud: string;
  waves: [back: string, middle: string, front: string];
  /** Wave height in viewBox units. */
  waveAmplitude: number;
  /** Multiplies wave speed. */
  waveSpeed: number;
  /** Temperature shown while previewing a scene the agent didn't report. */
  sampleCelsius: number;
}

export const THEMES: Record<Scene, WeatherTheme> = {
  sunny: {
    label: 'Sunny',
    sky: 'linear-gradient(170deg, #1f7bff 0%, #4fb0ff 30%, #ffd27a 70%, #ff8a4c 100%)',
    shadow: 'rgba(255, 138, 76, 0.6)',
    cloud: '#ffffff',
    waves: ['rgba(56, 189, 248, 0.55)', 'rgba(14, 116, 204, 0.8)', '#0b4a8f'],
    waveAmplitude: 10,
    waveSpeed: 1,
    sampleCelsius: 27,
  },
  cloudy: {
    label: 'Cloudy',
    sky: 'linear-gradient(170deg, #4c5d80 0%, #7f93b8 45%, #c6d1e6 100%)',
    shadow: 'rgba(71, 85, 105, 0.6)',
    cloud: '#eef2fa',
    waves: ['rgba(148, 163, 184, 0.5)', 'rgba(71, 85, 105, 0.8)', '#2c3a52'],
    waveAmplitude: 11,
    waveSpeed: 1.1,
    sampleCelsius: 18,
  },
  rainy: {
    label: 'Rain',
    sky: 'linear-gradient(170deg, #141d38 0%, #2a3d68 50%, #4a6291 100%)',
    shadow: 'rgba(37, 99, 235, 0.55)',
    cloud: '#34436a',
    waves: ['rgba(59, 130, 246, 0.35)', 'rgba(30, 64, 175, 0.65)', '#111c45'],
    waveAmplitude: 15,
    waveSpeed: 1.7,
    sampleCelsius: 12,
  },
  stormy: {
    label: 'Thunderstorm',
    sky: 'linear-gradient(170deg, #07061a 0%, #221848 50%, #3c2a6e 100%)',
    shadow: 'rgba(124, 58, 237, 0.7)',
    cloud: '#252046',
    waves: ['rgba(139, 92, 246, 0.35)', 'rgba(76, 29, 149, 0.7)', '#160e30'],
    waveAmplitude: 24,
    waveSpeed: 2.6,
    sampleCelsius: 16,
  },
  snowy: {
    label: 'Snow',
    sky: 'linear-gradient(170deg, #5f8ee0 0%, #9fbff2 55%, #e2ebff 100%)',
    shadow: 'rgba(96, 142, 224, 0.6)',
    cloud: '#ffffff',
    waves: ['rgba(255, 255, 255, 0.5)', 'rgba(191, 216, 255, 0.75)', '#8eaee6'],
    waveAmplitude: 6,
    waveSpeed: 0.55,
    sampleCelsius: -3,
  },
  foggy: {
    label: 'Fog',
    sky: 'linear-gradient(170deg, #5d6573 0%, #959dab 50%, #d3d7de 100%)',
    shadow: 'rgba(100, 116, 139, 0.55)',
    cloud: '#e5e7eb',
    waves: ['rgba(229, 231, 235, 0.45)', 'rgba(156, 163, 175, 0.7)', '#5b6472'],
    waveAmplitude: 5,
    waveSpeed: 0.5,
    sampleCelsius: 8,
  },
};

export function sceneFor(conditions: string): Scene {
  const text = conditions.toLowerCase();
  if (/thunder|storm|lightning/.test(text)) return 'stormy';
  if (/snow|sleet|blizzard|ice/.test(text)) return 'snowy';
  if (/rain|drizzle|shower/.test(text)) return 'rainy';
  if (/fog|mist|haze|smoke/.test(text)) return 'foggy';
  if (/cloud|overcast/.test(text)) return 'cloudy';
  return 'sunny';
}
