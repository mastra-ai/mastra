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

interface ObservationGroupTag {
  start: number;
  end: number;
  attributeString: string;
  content: string;
}

const OBSERVATION_GROUP_OPEN = '<observation-group';
const OBSERVATION_GROUP_CLOSE = '</observation-group>';
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

function findObservationGroupTags(observations: string): ObservationGroupTag[] {
  const tags: ObservationGroupTag[] = [];
  let cursor = 0;

  while (cursor < observations.length) {
    const start = observations.indexOf(OBSERVATION_GROUP_OPEN, cursor);
    if (start === -1) break;

    const attributesStart = start + OBSERVATION_GROUP_OPEN.length;
    if (!/\s/.test(observations[attributesStart] ?? '')) {
      cursor = attributesStart;
      continue;
    }

    const openEnd = observations.indexOf('>', attributesStart);
    if (openEnd === -1) break;

    const closeStart = observations.indexOf(OBSERVATION_GROUP_CLOSE, openEnd + 1);
    if (closeStart === -1) break;

    tags.push({
      start,
      end: closeStart + OBSERVATION_GROUP_CLOSE.length,
      attributeString: observations.slice(attributesStart, openEnd),
      content: observations.slice(openEnd + 1, closeStart),
    });
    cursor = closeStart + OBSERVATION_GROUP_CLOSE.length;
  }

  return tags;
}

function replaceObservationGroupTags(observations: string, replace: (tag: ObservationGroupTag) => string): string {
  const parts: string[] = [];
  let cursor = 0;

  for (const tag of findObservationGroupTags(observations)) {
    parts.push(observations.slice(cursor, tag.start), replace(tag));
    cursor = tag.end;
  }

  parts.push(observations.slice(cursor));
  return parts.join('');
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

  for (const tag of findObservationGroupTags(observations)) {
    const attributes = parseObservationGroupAttributes(tag.attributeString);
    const id = attributes.id;
    const range = attributes.range;

    if (!id || !range) {
      continue;
    }

    groups.push({
      id,
      range,
      kind: attributes.kind,
      content: tag.content.trim(),
    });
  }

  return groups;
}

export function stripObservationGroups(observations: string): string {
  if (!observations) {
    return observations;
  }

  return replaceObservationGroupTags(observations, tag => tag.content.trim())
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
  const segments = Array.from(new Set(groups.flatMap(group => getRangeSegments(group.range))));
  if (segments.length === 0) {
    return '';
  }

  const endpoints: Array<{ label: string; value: number }> = [];
  for (const segment of segments) {
    const parts = segment.split(':').map(part => part.trim());
    if (parts.length !== 2 || parts.some(part => !/^\d+$/.test(part))) {
      return segments.join(',');
    }

    for (const label of parts) {
      const value = Number(label);
      if (!Number.isSafeInteger(value)) {
        return segments.join(',');
      }
      endpoints.push({ label, value });
    }
  }

  const first = endpoints.reduce((lowest, endpoint) => (endpoint.value < lowest.value ? endpoint : lowest));
  const last = endpoints.reduce((highest, endpoint) => (endpoint.value > highest.value ? endpoint : highest));
  return `${first.label}:${last.label}`;
}

export function renderObservationGroupsForReflection(observations: string): string | null {
  const groups = parseObservationGroups(observations);
  if (groups.length === 0) {
    return null;
  }

  const result = replaceObservationGroupTags(observations, tag => {
    const attributes = parseObservationGroupAttributes(tag.attributeString);
    if (!attributes.id || !attributes.range) return tag.content.trim();
    return `## Group \`${attributes.id}\`\n_range: \`${attributes.range}\`_\n\n${tag.content.trim()}`;
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
    const canonicalGroupId = getCanonicalGroupId(section.heading, index);
    const identifiedGroup = groups.find(group => group.id === canonicalGroupId);
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
    const resolvedGroups = identifiedGroup
      ? [identifiedGroup]
      : matchingGroups.length > 0
        ? matchingGroups
        : fallbackGroup
          ? [fallbackGroup]
          : [];

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
