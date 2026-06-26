import type { DirectoryListing } from '../../../api/types';

export function listing(path: string, names: string[], parent: string | null = null): DirectoryListing {
  return {
    root: '/home/user',
    path,
    parent,
    entries: names.map(name => ({ name, path: `${path}/${name}` })),
  };
}
