const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
const INDENTED = /^(?:\t| {2,})/;
const DEFINITION = /^ {0,3}\[[^\]]+\]:/;
// The end of a definition's label, at any depth of any item and on any of its lines: it resolves across the whole list.
const DEFINITION_LABEL_END = /\]:/;
const ITEM = /^( {0,3})(?:([-*+])|(\d{1,9})([.)]))( {1,4})(?=\S)/;
// A marker the stream has not written any text after yet.
const EMPTY_ITEM = /^ {0,3}(?:([-*+])|(\d{1,9})([.)])) *$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const CHECKBOX = /^\[[ \txX]\](.*)$/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
// Unlike FENCE_OPEN, exact: a backtick in the info string makes the line inline code, not a fence.
const ITEM_FENCE = /^ {0,3}(?:(`{3,})[^`]*|(~{3,}).*)$/;
// A fence the item does not open itself, or raw HTML, here or behind a nested marker or quote: either can
// hold a blank line the lines cannot place.
const OPAQUE = /```|~~~|^(?:\s*(?:(?:[-*+]|\d{1,9}[.)])(?=\s)|>))*\s*</;

function fenceOpenedBy(line: string): string | undefined {
  return FENCE_OPEN.exec(line)?.[1];
}

// Both are runs of one character, so `startsWith` is "same marker, at least as long".
function closesFence(line: string, marker: string): boolean {
  return FENCE_CLOSE.exec(line)?.[1]?.startsWith(marker) ?? false;
}

function startsBlock(line: string, inList: boolean): boolean {
  if (INDENTED.test(line)) return false;

  return !(inList && LIST_ITEM.test(line));
}

/**
 * Cuts markdown into top-level blocks so a growing reply re-parses its last
 * block instead of all of them. Rejoining the result returns the input, and
 * every block renders as it would have inside the whole.
 *
 * Each rule only ever merges: over-merging costs a re-parse, while cutting a
 * construct in two changes what it renders as. Link reference and footnote
 * definitions resolve across blank lines, which no line-level rule can see, so
 * reaching one outside a fence abandons the split for the whole text.
 */
export function splitBlocks(markdown: string): string[] {
  const lines = markdown.split('\n');
  const starts = [0];
  let fence: string | undefined;
  let started = false;
  let broken = false;
  let inList = false;

  for (const [index, line] of lines.entries()) {
    if (fence) {
      if (closesFence(line, fence)) fence = undefined;
      continue;
    }

    if (line.trim() === '') {
      broken = started;
      continue;
    }

    if (DEFINITION.test(line)) return [markdown];

    if (broken && startsBlock(line, inList)) {
      starts.push(index);
      started = false;
    }

    if (!started) inList = LIST_ITEM.test(line);

    started = true;
    broken = false;
    fence = fenceOpenedBy(line);
  }

  return starts.map((start, position) => {
    const end = starts[position + 1];
    const block = lines.slice(start, end ?? lines.length).join('\n');

    return end === undefined ? block : `${block}\n`;
  });
}

export interface ListBlock {
  ordered: boolean;
  start: number;
  loose: boolean;
  tasks: boolean;
  items: string[];
}

interface ListItemStart {
  kind: string;
  width: number;
  start: number;
}

/** `last` admits an item with nothing after its marker yet, which only the last line can be: no content follows it. */
function listItemStart(line: string, last = false): ListItemStart | undefined {
  const match = ITEM.exec(line);
  if (match && !THEMATIC_BREAK.test(line)) {
    const [prefix, , bullet, digits, delimiter] = match;

    return { kind: bullet ?? delimiter ?? '', width: prefix.length, start: Number(digits ?? 1) };
  }

  const empty = last ? EMPTY_ITEM.exec(line) : null;
  if (!empty) return undefined;

  return { kind: empty[1] ?? empty[3] ?? '', width: line.length, start: Number(empty[2] ?? 1) };
}

/**
 * Whether GFM reads the item as a task, from the text after its marker. Undefined
 * where the first line alone cannot tell: a `[` whose closing bracket may still
 * be on its way, or a checkbox with nothing after it on that line.
 */
function isTask(content: string): boolean | undefined {
  if (!content.startsWith('[')) return false;

  const rest = CHECKBOX.exec(content)?.[1];
  if (rest === undefined) return content === '[' ? undefined : false;
  if (rest.trim() === '') return undefined;

  return /^[ \t]/.test(rest);
}

/**
 * Cuts a block that is one list into its top-level items, so a list still being
 * written re-parses its last item instead of all of them. Rejoining the items
 * returns the block.
 *
 * An item parsed on its own renders as it does in the list once the list's own
 * facts are known: its first number, whether it holds a task, whether it is
 * loose. A blank line before an item makes the list loose, unless it sits in a
 * fence or raw HTML the item leaves open; a blank line inside an item may or may
 * not, depending on what it sits in, so a list with only those stays whole. So
 * does anything else the lines cannot settle: lazy continuation, a change of
 * marker, tabs, a half-written checkbox, a definition other items may use.
 */
export function splitList(block: string): ListBlock | undefined {
  const lines = block.split('\n');
  const head = listItemStart(lines[0] ?? '');
  if (!head) return undefined;

  const starts: number[] = [];
  const last = lines.findLastIndex(line => line.trim() !== '');
  let width = 0;
  let fence: string | undefined;
  let opaque = false;
  let blank = false;
  let blankInside = false;
  let loose = false;
  let tasks = false;
  let taskLine = false;

  for (const [index, line] of lines.entries()) {
    if (line.trim() === '') {
      blank = true;
      taskLine = false;
      continue;
    }

    const indent = line.length - line.trimStart().length;
    if (line.slice(0, indent).includes('\t') || DEFINITION_LABEL_END.test(line)) return undefined;

    let content = line.slice(width);
    // An underline straight after a task's line makes it a heading, and the list no longer holds a task.
    if (taskLine && indent >= width && SETEXT_UNDERLINE.test(content)) return undefined;
    taskLine = false;

    if (index === 0 || indent < width) {
      const item = listItemStart(line, index === last);
      if (item?.kind !== head.kind || (blank && (fence || opaque))) return undefined;

      content = line.slice(item.width);
      const task = isTask(content);
      if (task === undefined) return undefined;

      starts.push(index);
      width = item.width;
      fence = undefined;
      opaque = false;
      tasks ||= task;
      taskLine = task;
      loose ||= blank;
    } else {
      blankInside ||= blank;
    }

    blank = false;

    if (fence) {
      if (closesFence(content, fence)) fence = undefined;
    } else {
      const opened = ITEM_FENCE.exec(content);
      fence = opened?.[1] ?? opened?.[2];
      opaque ||= !fence && OPAQUE.test(content);
    }
  }

  if (starts.length < 2 || (blankInside && !loose)) return undefined;

  const items = starts.map((start, position) => {
    const end = starts[position + 1];
    const item = lines.slice(start, end ?? lines.length).join('\n');

    return end === undefined ? item : `${item}\n`;
  });

  return { ordered: head.kind === '.' || head.kind === ')', start: head.start, loose, tasks, items };
}
