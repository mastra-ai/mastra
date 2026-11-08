import { z } from 'zod';
import { parseInput } from '../billing/contracts.js';

export const observationsSchema = z.strictObject({
  location: z.string().trim().min(1).max(120),
  observedAt: z.iso.datetime({ offset: true }),
  temperatureC: z.number().min(-90).max(65),
  feelsLikeC: z.number().min(-100).max(80),
  humidityPercent: z.number().min(0).max(100),
  windKph: z.number().min(0).max(500),
  precipitationChancePercent: z.number().min(0).max(100),
  conditions: z.string().trim().min(1).max(300),
});
export type Observations = z.infer<typeof observationsSchema>;
export const weatherRequestSchema = z.strictObject({
  observations: observationsSchema,
  purpose: z.enum(['summary', 'draft', 'final']).default('summary'),
});
export function weatherPrompt(observations: unknown, purpose: 'summary' | 'draft' | 'final' = 'summary'): string {
  return JSON.stringify(parseInput(weatherRequestSchema, { observations, purpose }));
}
export function validateWeatherPrompt(prompt: string): string {
  let value: unknown;
  try {
    value = JSON.parse(prompt);
  } catch {
    value = null;
  }
  return JSON.stringify(parseInput(weatherRequestSchema, value));
}
export const reportApprovalSchema = z.strictObject({
  approved: z.literal(true),
  observations: observationsSchema.optional(),
});
