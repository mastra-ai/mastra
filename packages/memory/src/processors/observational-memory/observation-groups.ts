import { randomBytes } from 'node:crypto';

export interface ObservationGroup {
  id: string;
  range: string;
  content: string;
  kind?: string;
}

interface ReflectionObservationGroupSection {
  heading: string;
  body: string;
}

const OBSERVATION_GROUP_PATTERN = /<observation-group\s([^>]*)>([\s\S]*?)<\/observation-group>/g;
const ATTRIBUTE_PATTERN = /([\w][\w-]*)="([^"]*)"/g;
const REFLECTION_GROUP_SPLIT_PATTERN = /^##\s+Group\s+/m;

function parseObservationGroupAttributes(attributeString: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of attributeString.matchAll(ATTRIBUTE_PATTERN)) {
    const [, key, value] = match;
    if (key && value !== undefined) {
      attributes[key] = value;
    }
  }

  return attributes;
}

function parseReflectionObservationGroupSections(content: string): ReflectionObservationGroupSection[] {
  const normalizedContent = content.trim();
  if (!normalizedContent || !REFLECTION_GROUP_SPLIT_PATTERN.test(normalizedContent)) {
    return [];
  }

  return normalizedContent
    .split(REFLECTION_GROUP_SPLIT_PATTERN)
    .map(section => section.trim())
    .filter(Boolean)
    .map(section => {
      const newlineIndex = section.indexOf('\n');
      const heading = (newlineIndex >= 0 ? section.slice(0, newlineIndex) : section).trim();
      const body = (newlineIndex >= 0 ? section.slice(newlineIndex + 1) : '').trim();

      return {
        heading,
        body: stripReflectionGroupMetadata(body),
      };
    });
}

function stripReflectionGroupMetadata(body: string): string {
  return body.replace(/^_range:\s*`[^`]*`_\s*\n?/m, '').trim();
}

export function generateAnchorId(): string {
  return randomBytes(8).toString('hex');
}

export function wrapInObservationGroup(
  observations: string,
  range: string,
  id = generateAnchorId(),
  _sourceGroupIds?: string[],
  kind?: string,
): string {
  const content = observations.trim();
  const kindAttr = kind ? ` kind="${kind}"` : '';
  return `<observation-group id="${id}" range="${range}"${kindAttr}>\n${content}\n</observation-group>`;
}

export function parseObservationGroups(observations: string): ObservationGroup[] {
  if (!observations) {
    return [];
  }

  const groups: ObservationGroup[] = [];
  let match: RegExpExecArray | null;

  while ((match = OBSERVATION_GROUP_PATTERN.exec(observations)) !== null) {
    const attributes = parseObservationGroupAttributes(match[1] ?? '');
    const id = attributes.id;
    const range = attributes.range;

    if (!id || !range) {
      continue;
    }

    groups.push({
      id,
      range,
      kind: attributes.kind,
      content: match[2]!.trim(),
    });
  }

  return groups;
}

export function stripObservationGroups(observations: string): string {
  if (!observations) {
    return observations;
  }

  return observations
    .replace(OBSERVATION_GROUP_PATTERN, (_match, _attributes, content: string) => content.trim())
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getRangeSegments(range: string): string[] {
  return range
    .split(',')
    .map(segment => segment.trim())
    .filter(Boolean);
}

export function combineObservationGroupRanges(groups: ObservationGroup[]): string {
  const segments = groups.flatMap(group => getRangeSegments(group.range));
  if (segments.length === 0) {
    return '';
  }

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const firstStart = firstSegment?.split(':')[0]?.trim();
  const lastEnd = lastSegment?.split(':').at(-1)?.trim();

  if (firstStart && lastEnd) {
    return `${firstStart}:${lastEnd}`;
  }

  return Array.from(new Set(segments)).join(',');
}

export function renderObservationGroupsForReflection(observations: string): string | null {
  const groups = parseObservationGroups(observations);
  if (groups.length === 0) {
    return null;
  }

  // Walk the string positionally: keep ungrouped text in place, replace each
  // <observation-group> tag with the rendered ## Group heading.
  const groupsByContent = new Map(groups.map(g => [g.content.trim(), g]));
  const result = observations.replace(OBSERVATION_GROUP_PATTERN, (_match, _attrs: string, content: string) => {
    const group = groupsByContent.get(content.trim());
    if (!group) return content.trim();
    return `## Group \`${group.id}\`\n_range: \`${group.range}\`_\n\n${group.content}`;
  });

  return result.replace(/\n{3,}/g, '\n\n').trim();
}

function getCanonicalGroupId(sectionHeading: string, fallbackIndex: number): string {
  const match = sectionHeading.match(/`([^`]+)`/);
  return match?.[1]?.trim() || `derived-group-${fallbackIndex + 1}`;
}

export function deriveObservationGroupProvenance(content: string, groups: ObservationGroup[]): ObservationGroup[] {
  const sections = parseReflectionObservationGroupSections(content);
  if (sections.length === 0 || groups.length === 0) {
    return [];
  }

  return sections.map((section, index) => {
    const bodyLines = new Set(
      section.body
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean),
    );

    const matchingGroups = groups.filter(group => {
      const groupLines = group.content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      return groupLines.some(line => bodyLines.has(line));
    });

    const fallbackGroup = groups[Math.min(index, groups.length - 1)];
    const resolvedGroups = matchingGroups.length > 0 ? matchingGroups : fallbackGroup ? [fallbackGroup] : [];
    const canonicalGroupId = getCanonicalGroupId(section.heading, index);

    return {
      id: canonicalGroupId,
      range: combineObservationGroupRanges(resolvedGroups),
      kind: 'reflection',
      content: section.body,
    };
  });
}

export function reconcileObservationGroupsFromReflection(content: string, sourceObservations: string): string | null {
  const sourceGroups = parseObservationGroups(sourceObservations);
  if (sourceGroups.length === 0) {
    return null;
  }

  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return '';
  }

  const derivedGroups = deriveObservationGroupProvenance(normalizedContent, sourceGroups);
  if (derivedGroups.length > 0) {
    return derivedGroups
      .map(group => wrapInObservationGroup(group.content, group.range, group.id, undefined, group.kind))
      .join('\n\n');
  }

  return wrapInObservationGroup(
    normalizedContent,
    combineObservationGroupRanges(sourceGroups),
    generateAnchorId(),
    undefined,
    'reflection',
  );
}
