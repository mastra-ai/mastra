interface ScorerRegistration {
  id?: string;
  source?: string;
}

export function isStoredScorerRegistration(
  scorers: Record<string, ScorerRegistration> | undefined,
  registrationKey: string,
): boolean {
  return scorers?.[registrationKey]?.source === 'stored';
}
