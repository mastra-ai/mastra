/** Split SSE events without rescanning or copying an unfinished event on each read. */
export function createSseEventSplitter() {
  let parts: string[] = [];
  // Hold the final newline separately so a delimiter split across reads can be
  // recognized without joining the accumulated event.
  let pendingNewline = false;

  return (text: string, isFinal = false): string[] => {
    const events: string[] = [];
    let start = 0;

    if (text) {
      if (pendingNewline) {
        if (text.startsWith('\n')) {
          events.push(parts.join(''));
          parts = [];
          start = 1;
        } else {
          parts.push('\n');
        }
        pendingNewline = false;
      }

      let separator: number;
      while ((separator = text.indexOf('\n\n', start)) !== -1) {
        parts.push(text.slice(start, separator));
        events.push(parts.join(''));
        parts = [];
        start = separator + 2;
      }

      if (start < text.length) {
        pendingNewline = text.endsWith('\n');
        const end = pendingNewline ? text.length - 1 : text.length;
        if (start < end) parts.push(text.slice(start, end));
      }
    }

    if (isFinal) {
      if (pendingNewline) parts.push('\n');
      events.push(parts.join(''));
      parts = [];
      pendingNewline = false;
    }

    return events;
  };
}
