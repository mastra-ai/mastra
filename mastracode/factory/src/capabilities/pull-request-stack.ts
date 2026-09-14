import { z } from 'zod';

const pullRequestStackSchema = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  position: z.number().int().positive(),
  base: z.object({ ref: z.string().min(1) }),
});

export type PullRequestStack = z.infer<typeof pullRequestStackSchema>;

export function readPullRequestStack(value: unknown): PullRequestStack | undefined {
  return pullRequestStackSchema.safeParse(value).data;
}
