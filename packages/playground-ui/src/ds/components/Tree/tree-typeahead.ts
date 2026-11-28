export function findTypeaheadMatch(labels: readonly string[], current: number, query: string) {
  const typed = query.toLocaleLowerCase();
  const cycling = [...typed].every(char => char === typed[0]);
  const search = cycling ? typed.slice(0, 1) : typed;
  const start = cycling ? current + 1 : current;
  for (let offset = 0; offset < labels.length; offset++) {
    const index = (start + offset) % labels.length;
    if (labels[index]?.toLocaleLowerCase().startsWith(search)) return index;
  }
  return -1;
}
