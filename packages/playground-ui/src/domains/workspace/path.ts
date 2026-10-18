/** Workspace paths follow the server convention: `.` is the root, everything else is relative. */
export const ROOT_PATH = '.';

export const joinPath = (parent: string, name: string) => (parent === ROOT_PATH ? name : `${parent}/${name}`);

/** Folders containing `path`, outermost first: `a/b/c.md` → `['a', 'a/b']`. */
export const ancestorsOf = (path: string) =>
  path
    .split('/')
    .slice(0, -1)
    .map((_, i, parts) => parts.slice(0, i + 1).join('/'));

export const parentOf = (path: string) => {
  const index = path.lastIndexOf('/');
  return index === -1 ? ROOT_PATH : path.slice(0, index);
};
