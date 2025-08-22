export type UUIDv4 = `${string}-${string}-${string}-${string}-${string}`;
export type TemperatureScale = 'celsius' | 'fahrenheit';
export type Weather = {
  scale: TemperatureScale;
  temperature: number;
};
export type Time = `${number}:${number} ${'AM' | 'PM'}`;
