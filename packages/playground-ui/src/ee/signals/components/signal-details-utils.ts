// The signals UI is keyed by signal name, so the route `signalId` is already the
// display name. Kept as a function so the breadcrumb call site stays stable.
export function getSignalName(signalId: string) {
  return signalId;
}
