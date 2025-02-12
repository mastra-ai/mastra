/**
 *
 * @param duration duration of the span
 * @param fixedPoint how many fixed point
 * @returns duration in milliseconds in fixed points
 */
export function formatDuration(duration: number, fixedPoint = 2) {
  const durationInSecs = duration / 1_000_000_000;

  return durationInSecs.toFixed(fixedPoint);
}

export function formatOtelTimestamp(otelTimestamp: number) {
  const date = new Date(otelTimestamp / 1000);

  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
  }).format(date);
}

export function transformKey(key: string) {
  if (key.includes('.argument.')) {
    return `Input`;
  }
  if (key.includes('.result')) {
    return 'Output';
  }
  return key.split('.').join(' ').split('_');
}

export function cleanString(string: string) {
  return (
    string
      .replace(/\\n/g, '')
      // Also handle any actual newlines
      .replace(/\n/g, '')
      // Clean up any resulting extra spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}
