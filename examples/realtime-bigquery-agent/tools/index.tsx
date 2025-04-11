import { z } from 'zod';

export const renderDetailsSchema = z.object({
  name: z.string(),
  description: z.string(),
  attributes: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
});

export type RenderDetailsInput = z.infer<typeof renderDetailsSchema>;

export const renderListSchema = z.object({
  items: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
});

export type RenderListInput = z.infer<typeof renderListSchema>;

export const renderTableSchema = z.object({
  columns: z.array(z.string()),
  data: z.array(z.array(z.string())),
});

export type RenderTableInput = z.infer<typeof renderTableSchema>;

export const renderChartSchema = z.object({
  data: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
    }),
  ),
});

export type RenderChartInput = z.infer<typeof renderChartSchema>;
