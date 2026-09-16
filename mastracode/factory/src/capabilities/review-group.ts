import { z } from 'zod';

const reviewGroupSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  position: z.number().int().positive(),
  targetBranch: z.string().min(1).optional(),
});

export type ReviewGroup = z.infer<typeof reviewGroupSchema>;

export function readReviewGroup(value: unknown): ReviewGroup | undefined {
  return reviewGroupSchema.safeParse(value).data;
}
