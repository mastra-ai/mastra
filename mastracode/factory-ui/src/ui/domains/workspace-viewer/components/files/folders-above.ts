export function foldersAbove(path: string): string[] {
  const folders: string[] = [];
  for (let slash = path.indexOf('/'); slash !== -1; slash = path.indexOf('/', slash + 1)) {
    folders.push(path.slice(0, slash));
  }
  return folders;
}
