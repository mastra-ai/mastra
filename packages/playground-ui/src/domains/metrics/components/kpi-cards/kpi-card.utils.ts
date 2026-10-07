export function hasKpiChange(changePct: number | null | undefined): changePct is number {
  return changePct != null && changePct !== 0;
}
