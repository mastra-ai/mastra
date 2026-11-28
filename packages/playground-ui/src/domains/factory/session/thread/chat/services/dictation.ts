export function mergeDictation(draft: string, replacing: string, transcript: string): string {
  if (!replacing) {
    if (!transcript) return draft;
    return draft.trim() ? `${draft.trimEnd()} ${transcript}` : transcript;
  }
  if (draft.endsWith(replacing)) return draft.slice(0, draft.length - replacing.length) + transcript;
  return transcript.startsWith(replacing) ? draft + transcript.slice(replacing.length) : draft;
}
