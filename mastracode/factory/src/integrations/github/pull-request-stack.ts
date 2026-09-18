import { z } from 'zod';
import type { ReviewGroup } from '../../capabilities/review-group.js';

const githubStackSchema = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  position: z.number().int().positive(),
  base: z.object({ ref: z.string().min(1) }),
});

export function readGithubReviewGroup(value: unknown, pullRequestUrl: string): ReviewGroup | null | undefined {
  if (value === undefined || value === null) return null;
  const parsed = githubStackSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const stack = parsed.data;
  const url = new URL(pullRequestUrl);
  const repositoryPath = url.pathname.slice(0, url.pathname.lastIndexOf('/pull/')).toLowerCase();
  return {
    key: `github:${url.origin}${repositoryPath}:stack:${stack.id}`,
    label: `Stack #${stack.number}`,
    position: stack.position,
    targetBranch: stack.base.ref,
  };
}

export function parseGithubReviewGroup(value: unknown, pullRequestUrl: string): ReviewGroup | null {
  const group = readGithubReviewGroup(value, pullRequestUrl);
  if (group === undefined) throw new Error(`Invalid GitHub stack metadata for ${pullRequestUrl}`);
  return group;
}
