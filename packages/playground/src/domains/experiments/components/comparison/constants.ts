/** Most experiments compared at once: one baseline plus up to nine contenders. Matches the server limit. */
export const MAX_COMPARED_EXPERIMENTS = 10;

/** Badge colour of each comparison role, shared by the experiments list and the compare page. */
export const sideVariant = { baseline: 'purple', contender: 'blue' } as const;

/** The first compared experiment is the baseline; the others are numbered contenders. */
export const columnLabel = (index: number) => (index === 0 ? 'Baseline' : `Contender ${index}`);
