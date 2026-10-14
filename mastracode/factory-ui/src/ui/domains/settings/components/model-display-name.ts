function titleCase(value: string): string {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

function lastSegment(id: string): string {
  const parts = id.trim().split('/');
  return parts[parts.length - 1] || id;
}

/** Human-readable name for a `provider/model` id, e.g. `anthropic/claude-haiku-4-5` → `Claude Haiku 4.5`. */
export function formatModelName(id: string): string {
  // Bedrock-style ids put the vendor in front of the model: `anthropic.claude-sonnet-4-5`.
  const slug = lastSegment(id).replace(/^[a-z]+\./i, '');
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

/** Provider segment of a `provider/model` id, or `''` when the id has none. */
export function modelProvider(id: string): string {
  const slash = id.indexOf('/');
  return slash > 0 ? id.slice(0, slash) : '';
}
