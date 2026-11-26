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

const decodeSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
};

export const resolveRelativePath = (fromFile: string, link: string): string | undefined => {
  if (!link || /^[a-z][a-z0-9+.-]*:|^\/|^#/i.test(link)) return undefined;
  const parts = parentOf(fromFile) === ROOT_PATH ? [] : parentOf(fromFile).split('/');
  for (const raw of (link.split(/[?#]/)[0] ?? '').split('/')) {
    const part = decodeSegment(raw);
    if (part === undefined || part.includes('/')) return undefined;
    if (part === '' || part === '.') continue;
    if (part !== '..') parts.push(part);
    else if (parts.pop() === undefined) return undefined;
  }
  return parts.length > 0 ? parts.join('/') : undefined;
};
