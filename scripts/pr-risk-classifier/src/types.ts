export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type Risk = (typeof RISK_LEVELS)[number];

export type PullFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  sha?: string | null;
  patch?: string;
  previous_filename?: string;
};

export type PullRequestInput = {
  number: number;
  title: string;
  body: string | null;
  files: PullFile[];
};

export type FileKind =
  | 'changeset'
  | 'docs'
  | 'test'
  | 'ci'
  | 'lockfile'
  | 'manifest'
  | 'types'
  | 'example'
  | 'source';

export function isRisk(value: unknown): value is Risk {
  return typeof value === 'string' && (RISK_LEVELS as readonly string[]).includes(value);
}

export function maxRisk(a: Risk, b: Risk): Risk {
  return RISK_LEVELS.indexOf(a) >= RISK_LEVELS.indexOf(b) ? a : b;
}
