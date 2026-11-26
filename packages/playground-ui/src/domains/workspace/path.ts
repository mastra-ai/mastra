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

/** Drop leading and trailing `/`. A slash run in the middle is kept. */
export function trimEdgeSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === 47) start++;
  while (end > start && value.charCodeAt(end - 1) === 47) end--;
  return start === 0 && end === value.length ? value : value.slice(start, end);
}

/**
 * Folder paths typed in the workspace dialog: `./docs/` and `/docs/` both
 * become `docs`. A `..` prefix is left in place.
 */
export function trimDotSlashPath(value: string): string {
  const skipDot = value.charCodeAt(0) === 46 && value.charCodeAt(1) === 47 ? 1 : 0;
  return trimEdgeSlashes(skipDot === 0 ? value : value.slice(skipDot));
}
