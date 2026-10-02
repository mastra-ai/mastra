export function titleCase(value: string): string {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

function lastSegment(id: string): string {
  const parts = id.trim().split('/');
  return parts[parts.length - 1] || id;
}

export function formatModelName(id: string): string {
  const slug = lastSegment(id);
  const claudeMatch = slug.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)$/i);
  const claudeFamily = claudeMatch?.[1];
  const claudeMajor = claudeMatch?.[2];
  const claudeMinor = claudeMatch?.[3];
  if (claudeFamily && claudeMajor && claudeMinor) {
    return `Claude ${titleCase(claudeFamily)} ${claudeMajor}.${claudeMinor}`;
  }

  const gptDetails = slug.match(/^gpt-(.+)$/i)?.[1];
  if (gptDetails) {
    const [version, ...qualifiers] = gptDetails.split('-');
    return [`GPT-${version}`, ...qualifiers.map(titleCase)].join(' ');
  }

  return slug.split(/[-_]+/).filter(Boolean).map(titleCase).join(' ');
}
