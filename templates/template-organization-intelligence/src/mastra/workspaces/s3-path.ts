/** Drop leading and trailing `/` from an S3 workspace path. */
export function trimEdgeSlashes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === 47) start++;
  while (end > start && value.charCodeAt(end - 1) === 47) end--;
  return start === 0 && end === value.length ? value : value.slice(start, end);
}
