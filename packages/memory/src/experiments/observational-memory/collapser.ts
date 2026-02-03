/**
 * Memory Collapser
 *
 * Handles collapsing of observation sections based on token thresholds.
 * This enables "graceful memory decay" where older observations are collapsed
 * into summaries while recent observations remain fully visible.
 *
 * Collapsed sections can be retrieved by their ID if the agent needs to
 * access the original content.
 */

import { TokenCounter } from './token-counter';

/**
 * A parsed observation section with parent and children
 */
export interface ObservationSection {
  /** Line number where section starts */
  startLine: number;
  /** Line number where section ends */
  endLine: number;
  /** The parent observation line (e.g., "- 🔴 User prefers...") */
  parentLine: string;
  /** The full content of the section */
  content: string;
  /** Child observation lines (indented items) */
  children: string[];
  /** Token count for this section */
  tokenCount: number;
  /** Whether this section can be collapsed */
  collapsible: boolean;
}

/**
 * Options for collapsing observations
 */
export interface CollapseOptions {
  /** Minimum number of children required to collapse a section (default: 5) */
  minChildrenToCollapse?: number;
  /** Regex patterns for sections that should never be collapsed */
  excludePatterns?: RegExp[];
  /** Number of most recent sections to keep uncollapsed (default: 2) */
  keepRecentCount?: number;
  /** Number of children to keep visible after collapse (default: 5) */
  keepLastChildren?: number;
}

/**
 * A collapsed section with its ID for retrieval
 */
export interface CollapsedSection {
  /** Unique ID for this collapsed section (4-character hex) */
  id: string;
  /** The original section before collapse */
  originalSection: ObservationSection;
  /** Original full content */
  originalContent: string;
  /** Collapsed representation text */
  collapsedText: string;
  /** Token count of collapsed representation */
  tokenCount: number;
  /** Number of items that were collapsed */
  itemCount: number;
}

/**
 * Result of collapsing observations
 */
export interface CollapseResult {
  /** The collapsed text (to be shown to the agent) */
  text: string;
  /** Sections that were collapsed (stored for retrieval) */
  collapsedSections: CollapsedSection[];
  /** Sections that remained uncollapsed */
  remainingSections: ObservationSection[];
  /** Total token count after collapsing */
  totalTokens: number;
  /** Tokens saved by collapsing */
  tokensSaved: number;
}

/**
 * Result of retrieving a collapsed section
 */
export interface RetrieveResult {
  success: boolean;
  section?: ObservationSection;
  error?: string;
}

// Token counter instance (shared)
const tokenCounter = new TokenCounter();

/**
 * Generate a deterministic ID for a collapsed section based on content hash.
 * Uses a simple hash function to create a 4-character hex ID.
 */
export function generateSectionId(parentContent: string, sectionIndex = 0): string {
  // Simple hash function (FNV-1a variant)
  // Incorporates sectionIndex to avoid collisions when parent lines are identical
  let hash = 2166136261;
  hash ^= sectionIndex;
  hash = (hash * 16777619) >>> 0;
  for (let i = 0; i < parentContent.length; i++) {
    hash ^= parentContent.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // Force unsigned 32-bit
  }
  // Convert to 4-digit hex
  return (hash & 0xffff).toString(16).padStart(4, '0');
}

/**
 * Parse observation content into sections.
 * A section is a parent item (starts with "- " at column 0) and all its indented children.
 */
export function parseObservationSections(content: string): ObservationSection[] {
  const lines = content.split('\n');
  const sections: ObservationSection[] = [];
  let currentParentLine = '';
  let currentStartLine = 0;
  let lastRecordedLineIndex = -1;
  let currentChildren: string[] = [];
  let currentContent: string[] = [];
  let inNonCollapsibleSection = false;

  const finishSection = (
    startLine: number,
    endLine: number,
    parentLine: string,
    contentLines: string[],
    children: string[],
    collapsible = true,
  ): ObservationSection => {
    const fullContent = contentLines.join('\n');
    const tokenCount = tokenCounter.countString(fullContent);

    return {
      startLine,
      endLine,
      parentLine,
      children,
      tokenCount,
      content: fullContent,
      collapsible,
    };
  };

  lines.forEach((line, index) => {
    // Skip empty lines and headers
    if (!line.trim() || line.startsWith('>') || line.startsWith('#')) {
      return;
    }

    const isParentItem = line.match(/^-\s/);
    const isChildItem = currentParentLine && !inNonCollapsibleSection && line.match(/^\s+-/);

    if ((isParentItem || isChildItem) && inNonCollapsibleSection) {
      // Finish the non-collapsible section
      sections.push(
        finishSection(
          currentStartLine,
          lastRecordedLineIndex,
          currentParentLine,
          currentContent,
          currentChildren,
          false,
        ),
      );
      // Reset so the isParentItem block below doesn't double-push the same section
      currentParentLine = '';
      currentChildren = [];
      currentContent = [];
    }

    if (isParentItem) {
      inNonCollapsibleSection = false;
      // Save previous section if exists
      if (currentParentLine) {
        sections.push(
          finishSection(currentStartLine, lastRecordedLineIndex, currentParentLine, currentContent, currentChildren),
        );
      }

      // Start new section
      currentStartLine = index;
      currentParentLine = line;
      currentChildren = [];
      currentContent = [line];
      lastRecordedLineIndex = index;
    } else if (isChildItem) {
      inNonCollapsibleSection = false;
      currentChildren.push(line);
      currentContent.push(line);
      lastRecordedLineIndex = index;
    } else {
      // Other content, not collapsible
      inNonCollapsibleSection = true;

      // Close current section if there is one
      if (currentParentLine) {
        sections.push(
          finishSection(currentStartLine, lastRecordedLineIndex, currentParentLine, currentContent, currentChildren),
        );
      }
      currentStartLine = index;
      currentParentLine = line;
      currentChildren = [];
      currentContent = [line];
      lastRecordedLineIndex = index;
    }
  });

  // Save last section
  if (currentParentLine) {
    sections.push(
      finishSection(
        currentStartLine,
        lastRecordedLineIndex,
        currentParentLine,
        currentContent,
        currentChildren,
        !inNonCollapsibleSection,
      ),
    );
  }

  return sections;
}

/**
 * Build collapsed representation of a section.
 * Shows: parent + collapsed marker + last N children
 */
function buildCollapsedRepresentation(
  section: ObservationSection,
  id: string,
  keepLastChildren: number = 5,
): { text: string; tokenCount: number } {
  const lines: string[] = [];

  // Add parent line
  lines.push(section.parentLine);

  // Calculate indentation from parent
  const indent = section.parentLine.match(/^(\s*)/)?.[1] || '';
  const childIndent = indent + '  ';

  // Calculate how many items to hide
  const hiddenCount = section.children.length - keepLastChildren;

  if (hiddenCount > 0) {
    // Add collapsed marker
    lines.push(`${childIndent}- 📦 [${hiddenCount} items collapsed - ID: ${id}]`);
  }

  // Add last N children (summary/resolution)
  if (section.children.length > 0) {
    const shownChildren = section.children.slice(-keepLastChildren);
    lines.push(...shownChildren);
  }

  const text = lines.join('\n');
  const tokenCount = tokenCounter.countString(text);

  return { text, tokenCount };
}

/**
 * Collapse observation sections based on options.
 *
 * @param observations - The raw observation text
 * @param options - Collapse options
 * @returns CollapseResult with collapsed text and metadata
 */
export function collapseObservations(observations: string, options: CollapseOptions = {}): CollapseResult {
  const { minChildrenToCollapse = 5, excludePatterns = [], keepRecentCount = 2, keepLastChildren = 5 } = options;

  const sections = parseObservationSections(observations);
  const collapsedSections: CollapsedSection[] = [];
  const remainingSections: ObservationSection[] = [];

  const totalTokensBefore = sections.reduce((sum, section) => sum + section.tokenCount, 0);
  let currentTokens = totalTokensBefore;

  // Sort sections by line number (oldest first)
  const sortedSections = [...sections].sort((a, b) => a.startLine - b.startLine);

  // Identify the most recent sections to keep uncollapsed
  const recentSections = new Set(keepRecentCount > 0 ? sortedSections.slice(-keepRecentCount) : []);

  // Helper to check if section matches exclude patterns
  const isExcluded = (section: ObservationSection): boolean => {
    return excludePatterns.some(pattern => pattern.test(section.parentLine));
  };

  // Process sections (oldest first)
  for (let i = 0; i < sortedSections.length; i++) {
    const section = sortedSections[i]!;
    if (
      // Skip if section is recent
      recentSections.has(section) ||
      // Skip if section matches exclude patterns
      isExcluded(section) ||
      // Skip if section is not collapsible
      section.collapsible === false ||
      // Skip if not enough children
      section.children.length < minChildrenToCollapse
    ) {
      remainingSections.push(section);
      continue;
    }

    // Collapse this section
    const id = generateSectionId(section.parentLine, i);
    const collapsed = buildCollapsedRepresentation(section, id, keepLastChildren);

    collapsedSections.push({
      id,
      originalSection: section,
      originalContent: [section.parentLine, ...section.children].join('\n'),
      collapsedText: collapsed.text,
      tokenCount: collapsed.tokenCount,
      itemCount: section.children.length,
    });

    currentTokens -= section.tokenCount - collapsed.tokenCount;
  }

  // Build final text by combining collapsed and remaining sections in order
  const allSections = [...collapsedSections, ...remainingSections].sort((a, b) => {
    const aLine = 'originalSection' in a ? a.originalSection.startLine : a.startLine;
    const bLine = 'originalSection' in b ? b.originalSection.startLine : b.startLine;
    return aLine - bLine;
  });

  const textLines: string[] = [];
  for (const section of allSections) {
    if ('collapsedText' in section) {
      textLines.push(section.collapsedText);
    } else {
      textLines.push(section.parentLine);
      textLines.push(...section.children);
    }
  }

  return {
    text: textLines.join('\n'),
    collapsedSections,
    remainingSections,
    totalTokens: currentTokens,
    tokensSaved: totalTokensBefore - currentTokens,
  };
}

/**
 * Retrieve a collapsed section by ID.
 *
 * @param id - The section ID to retrieve
 * @param collapsedSections - The array of collapsed sections to search
 * @returns RetrieveResult with the original section or error
 */
export function retrieveCollapsedSection(id: string, collapsedSections: CollapsedSection[]): RetrieveResult {
  const section = collapsedSections.find(s => s.id === id);

  if (!section) {
    return {
      success: false,
      error: `No collapsed section found with ID: ${id}`,
    };
  }

  return {
    success: true,
    section: section.originalSection,
  };
}

/**
 * Expand a collapsed section's content for display.
 * Returns the full original content as a string.
 */
export function expandCollapsedSection(id: string, collapsedSections: CollapsedSection[]): string | null {
  const result = retrieveCollapsedSection(id, collapsedSections);
  if (!result.success || !result.section) {
    return null;
  }
  return result.section.content;
}
