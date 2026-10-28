/** How a stretch header words one kind of tool: while running, done alone, and once or many times in a summary. */
export interface ToolPhrases {
  live: string;
  done: string;
  one: string;
  many: string;
}

/** Keyed by `presentTool(...).label`, the stable name of each kind of tool. */
const PHRASES: Record<string, ToolPhrases> = {
  Read: { live: 'Reading', done: 'Read', one: 'read a file', many: 'read files' },
  Write: { live: 'Writing', done: 'Wrote', one: 'wrote a file', many: 'wrote files' },
  Edit: { live: 'Editing', done: 'Edited', one: 'edited a file', many: 'edited files' },
  Run: { live: 'Running', done: 'Ran', one: 'ran a command', many: 'ran commands' },
  'Process output': {
    live: 'Reading output',
    done: 'Read output',
    one: 'read process output',
    many: 'read process output',
  },
  'Stop process': {
    live: 'Stopping process',
    done: 'Stopped process',
    one: 'stopped a process',
    many: 'stopped processes',
  },
  'Find files': { live: 'Finding files', done: 'Found files', one: 'found files', many: 'found files' },
  'List files': { live: 'Listing files', done: 'Listed files', one: 'listed files', many: 'listed files' },
  Search: { live: 'Searching', done: 'Searched', one: 'searched code', many: 'searched code' },
  'Search the web': {
    live: 'Searching the web',
    done: 'Searched the web',
    one: 'searched the web',
    many: 'searched the web',
  },
  'Inspect code': { live: 'Inspecting', done: 'Inspected', one: 'inspected code', many: 'inspected code' },
  'File info': { live: 'Checking', done: 'Checked', one: 'checked a file', many: 'checked files' },
  Delete: { live: 'Deleting', done: 'Deleted', one: 'deleted a file', many: 'deleted files' },
  'New folder': {
    live: 'Creating folder',
    done: 'Created folder',
    one: 'created a folder',
    many: 'created folders',
  },
  'Search skills': {
    live: 'Searching skills',
    done: 'Searched skills',
    one: 'searched skills',
    many: 'searched skills',
  },
  'Skill file': {
    live: 'Reading skill file',
    done: 'Read skill file',
    one: 'read a skill file',
    many: 'read skill files',
  },
};

export function toolPhrases(label: string): ToolPhrases {
  return (
    PHRASES[label] ?? { live: `Using ${label}`, done: `Used ${label}`, one: `used ${label}`, many: `used ${label}` }
  );
}
