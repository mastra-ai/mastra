export const workflowStatusColorMap: Record<string, string> = {
  DRAFT: '#DFCA7A',
  PUBLISHED: '#4BB042',
} as const;

export const workflowStatusTextMap: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Live',
} as const;
