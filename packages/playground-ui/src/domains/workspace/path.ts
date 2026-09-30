/** Workspace paths follow the server convention: `.` is the root, everything else is relative. */
export const ROOT_PATH = '.';

export const joinPath = (parent: string, name: string) => (parent === ROOT_PATH ? name : `${parent}/${name}`);

export const parentOf = (path: string) => {
  const index = path.lastIndexOf('/');
  return index === -1 ? ROOT_PATH : path.slice(0, index);
};
