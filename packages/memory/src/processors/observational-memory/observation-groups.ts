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

interface ObservationGroupScan {
  tags: ObservationGroupTag[];
  /**
   * Opening tags of groups that never close before a line-started sibling. Their content is not
   * attributable to the group, so they are not parsed, but the tag text must not leak into
   * stripped or rendered output.
   */
  incompleteOpenings: Array<{ start: number; end: number }>;
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

function isLineStart(observations: string, index: number): boolean {
  return index === 0 || observations[index - 1] === '\n';
}

function scanObservationGroupTags(observations: string): ObservationGroupScan {
  const tags: ObservationGroupTag[] = [];
  const incompleteOpenings: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  // Known closing tag at or after the cursor. Reusing it for successive openings stops malformed
  // input from re-walking the tail of the string once per opening.
  let closeFloor = 0;

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

    const closeStart = observations.indexOf(OBSERVATION_GROUP_CLOSE, Math.max(openEnd + 1, closeFloor));
    if (closeStart === -1) {
      // The opening never closes. Its content stays unattributed, but the tag text is metadata and
      // must still be dropped so it cannot leak into reflection prompts as stray XML.
      incompleteOpenings.push({ start, end: openEnd + 1 });
      break;
    }

    // Only a line-started opening can be a nested group: the producer always writes tags on their
    // own lines, so anything else is observation content that happens to mention the tag name.
    const nestedStart = observations.indexOf(OBSERVATION_GROUP_OPEN, openEnd + 1);
    if (nestedStart !== -1 && nestedStart < closeStart && isLineStart(observations, nestedStart)) {
      incompleteOpenings.push({ start, end: openEnd + 1 });
      closeFloor = closeStart;
      cursor = nestedStart;
      continue;
    }

    tags.push({
      start,
      end: closeStart + OBSERVATION_GROUP_CLOSE.length,
      attributeString: observations.slice(attributesStart, openEnd),
      content: observations.slice(openEnd + 1, closeStart),
    });
    closeFloor = closeStart;
    cursor = closeStart + OBSERVATION_GROUP_CLOSE.length;
  }

  return { tags, incompleteOpenings };
}

function replaceObservationGroupTags(observations: string, replace: (tag: ObservationGroupTag) => string): string {
  const { tags, incompleteOpenings } = scanObservationGroupTags(observations);
  const parts: string[] = [];
  let cursor = 0;
  let openingIndex = 0;

  // Accepted tags and incomplete openings are discovered left to right, so both lists are sorted
  // and never overlap. Walk them together, skipping the openings that were already consumed.
  const skipIncompleteOpeningsBefore = (limit: number) => {
    while (openingIndex < incompleteOpenings.length && incompleteOpenings[openingIndex]!.start < limit) {
      const opening = incompleteOpenings[openingIndex]!;
      openingIndex++;

      if (opening.start < cursor) continue;

      parts.push(observations.slice(cursor, opening.start));
      cursor = opening.end;
    }
  };

  for (const tag of tags) {
    skipIncompleteOpeningsBefore(tag.start);
    parts.push(observations.slice(cursor, tag.start), replace(tag));
    cursor = tag.end;
  }

  skipIncompleteOpeningsBefore(Number.POSITIVE_INFINITY);
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

  for (const tag of scanObservationGroupTags(observations).tags) {
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

function getRangeEndpoints(segment: string): { start: string; end: string } | null {
  const parts = segment.split(':').map(part => part.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return { start: parts[0], end: parts[1] };
}

/**
 * `buildMessageRange` produces opaque UUID endpoints, so those segments cannot be ordered by value.
 * Spanning from the first start to the last end keeps reflected metadata bounded — the full segment
 * list is deliberately not preserved (#14791). Segments that are not `start:end` pairs are left as
 * they are rather than being joined into a fabricated span.
 */
function spanRangeSegments(segments: string[]): string {
  const endpoints = segments.map(getRangeEndpoints);
  if (endpoints.some(endpoint => endpoint === null)) {
    return segments.join(',');
  }

  const first = endpoints[0]!;
  const last = endpoints.at(-1)!;
  return `${first.start}:${last.end}`;
}

export function combineObservationGroupRanges(groups: ObservationGroup[]): string {
  const segments = Array.from(new Set(groups.flatMap(group => getRangeSegments(group.range))));
  if (segments.length === 0) {
    return '';
  }

  // Numeric endpoints are orderable, so span by value: arrival order must never produce an
  // inverted range.
  const numericEndpoints: Array<{ start: { label: string; value: number }; end: { label: string; value: number } }> =
    [];
  const allNumeric = segments.every(segment => {
    const endpoints = getRangeEndpoints(segment);
    if (!endpoints || !/^\d+$/.test(endpoints.start) || !/^\d+$/.test(endpoints.end)) {
      return false;
    }

    const start = { label: endpoints.start, value: Number(endpoints.start) };
    const end = { label: endpoints.end, value: Number(endpoints.end) };
    if (!Number.isSafeInteger(start.value) || !Number.isSafeInteger(end.value)) {
      return false;
    }

    numericEndpoints.push(start.value <= end.value ? { start, end } : { start: end, end: start });
    return true;
  });

  if (!allNumeric) {
    return spanRangeSegments(segments);
  }

  const first = numericEndpoints.reduce((lowest, pair) => (pair.start.value < lowest.start.value ? pair : lowest));
  const last = numericEndpoints.reduce((highest, pair) => (pair.end.value > highest.end.value ? pair : highest));
  return `${first.start.label}:${last.end.label}`;
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

function getContentLines(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

export function deriveObservationGroupProvenance(content: string, groups: ObservationGroup[]): ObservationGroup[] {
  const sections = parseReflectionObservationGroupSections(content);
  if (sections.length === 0 || groups.length === 0) {
    return [];
  }

  return sections.map((section, index) => {
    const canonicalGroupId = getCanonicalGroupId(section.heading, index);
    const identifiedGroup = groups.find(group => group.id === canonicalGroupId);
    const bodyLines = new Set(getContentLines(section.body));

    const matchingGroups = groups.filter(group => getContentLines(group.content).some(line => bodyLines.has(line)));

    const fallbackGroup = groups[Math.min(index, groups.length - 1)];
    // A heading id pins the section to its own group, which is what keeps duplicate-content groups
    // distinct. Another matched group only contributes provenance when it carries a line the section
    // actually reflects and the identified group does not, so sharing a line alone cannot widen the
    // persisted range to facts the reflection never carried.
    const identifiedLines = new Set(getContentLines(identifiedGroup?.content ?? ''));
    const contributingGroups = identifiedGroup
      ? matchingGroups.filter(
          group =>
            group.id !== identifiedGroup.id &&
            getContentLines(group.content).some(line => bodyLines.has(line) && !identifiedLines.has(line)),
        )
      : [];

    // Source order is preserved: opaque segments are spanned positionally from the first start to
    // the last end, so leading with the heading's group would invert the span whenever the heading
    // names a later source group whose section also carries an earlier one.
    const resolvedGroups = identifiedGroup
      ? groups.filter(group => group === identifiedGroup || contributingGroups.includes(group))
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
