import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';
import { franc } from 'franc-min';

import { SOURCE_LIMITS } from '../config';

// v2 includes a rendered anchor's own destination, so existing v1 profiles stay explicitly incompatible.
export const NORMALIZATION_VERSION = 'semantic-v2';

export type NormalizedSection = { key: string; context: string; text: string; hash: string };
export type NormalizedContent = {
  language: 'english' | 'unsupported' | 'undetermined';
  metadataLanguage?: string;
  title?: string;
  primaryHeading?: string;
  sections: NormalizedSection[];
  text: string;
  hash: string;
  lossRatio: number;
  truncated: boolean;
};

/** Rebuilds renamed semantic hashes in memory without altering the persisted capture. */
export function contentForCurrentNormalization(content: NormalizedContent): NormalizedContent {
  return {
    ...content,
    hash: hash(`${NORMALIZATION_VERSION}\n${content.text}`),
    sections: content.sections.map(section => ({
      ...section,
      hash: hash(`${NORMALIZATION_VERSION}\n${section.text}`),
    })),
  };
}

export type Evidence = {
  id: string;
  sectionKey: string;
  beforeText: string;
  afterText: string;
  beforeExcerpt: string;
  afterExcerpt: string;
  excerptTruncated: boolean;
  kind: 'added' | 'removed' | 'modified';
};

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function languageOf(text: string, metadataLanguage?: string): NormalizedContent['language'] {
  const declared = metadataLanguage?.toLowerCase().split('-')[0];
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  if (letters < SOURCE_LIMITS.minLanguageLetters) return 'undetermined';
  const detected = franc(text, { minLength: SOURCE_LIMITS.minLanguageLetters });
  if (declared && declared !== 'en') return 'unsupported';
  if (detected === 'und') return 'undetermined';
  if (detected !== 'eng') return 'unsupported';
  return 'english';
}

/**
 * Turns visible DOM into small semantic units. Layout containers deliberately recurse:
 * a div is not content in its own right, while paragraphs, list items and table rows are.
 */
export function normalizeHtml(
  html: string,
  options: { contentSelector?: string; ignoreSelectors?: string[] } = {},
): NormalizedContent {
  const $ = cheerio.load(html);
  const metadataLanguage = $('html').attr('lang') || $('meta[http-equiv="content-language"]').attr('content');
  const title = cleanText($('title').first().text()) || undefined;
  $('script, style, noscript, template, svg, canvas, iframe, [hidden], [aria-hidden="true"]').remove();
  $('[style]').each((_, element) => {
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test($(element).attr('style') ?? '')) $(element).remove();
  });
  for (const selector of options.ignoreSelectors ?? []) $(selector).remove();
  const main = $('main').first();
  const article = $('article').first();
  const root = options.contentSelector
    ? $(options.contentSelector).first()
    : main.length
      ? main
      : article.length
        ? article
        : $('body').first();
  if (!root.length) throw new Error('CONTENT_SELECTOR_MISSING');

  const sections: NormalizedSection[] = [];
  const headingCounts = new Map<string, number>();
  const unitCounts = new Map<string, number>();
  let currentContext = 'document#1';
  let primaryHeading: string | undefined;
  const append = (type: string, value: string) => {
    const text = cleanText(value);
    if (!text) return;
    const countKey = `${currentContext}\u0000${type}`;
    const count = (unitCounts.get(countKey) ?? 0) + 1;
    unitCounts.set(countKey, count);
    sections.push({
      key: `${type}:${currentContext}#${count}`,
      context: currentContext,
      text,
      hash: hash(`${NORMALIZATION_VERSION}\n${text}`),
    });
  };
  const renderedText = (element: any) => {
    const ownAnchor = $(element).is('a[href]');
    // A direct anchor contributes its label through the link representation below. Its raw text
    // would otherwise repeat that label before the same destination evidence.
    const text = ownAnchor ? '' : cleanText($(element).text());
    const anchors = new Set<any>();
    if (ownAnchor) anchors.add(element);
    $(element)
      .find('a[href]')
      .each((_, link) => {
        anchors.add(link);
      });
    const links = [...anchors]
      .map(link => {
        const label = cleanText($(link).text());
        const href = $(link).attr('href');
        return label && href !== undefined ? `${label} <${href}>` : '';
      })
      .filter(Boolean);
    return links.length ? `${text} ${links.join(' ')}` : text;
  };
  const visitChildren = (parent: any): void => {
    let inline: string[] = [];
    const flushInline = () => {
      append('inline', inline.join(' '));
      inline = [];
    };
    for (const child of parent.children ?? []) {
      if (child.type === 'text') {
        inline.push(child.data ?? '');
        continue;
      }
      if (child.type !== 'tag') continue;
      const tag = child.name.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        flushInline();
        const heading = renderedText(child);
        if (!heading) continue;
        const normalizedHeading = heading.toLowerCase();
        const occurrence = (headingCounts.get(normalizedHeading) ?? 0) + 1;
        headingCounts.set(normalizedHeading, occurrence);
        currentContext = `heading:${normalizedHeading}#${occurrence}`;
        primaryHeading ??= heading;
        append('heading', heading);
        continue;
      }
      if (tag === 'p' || tag === 'li') {
        flushInline();
        append(tag, renderedText(child));
        continue;
      }
      if (tag === 'tr') {
        flushInline();
        const cells = $(child)
          .children('th, td')
          .map((_, cell) => renderedText(cell))
          .get()
          .filter(Boolean);
        append('row', cells.join(' | '));
        continue;
      }
      if (tag === 'br' || tag === 'hr') {
        flushInline();
        continue;
      }
      if (['a', 'abbr', 'b', 'code', 'em', 'i', 'small', 'span', 'strong', 'time'].includes(tag)) {
        inline.push(renderedText(child));
        continue;
      }
      flushInline();
      visitChildren(child);
    }
    flushInline();
  };
  visitChildren(root[0]);
  if (!sections.length) append('document', renderedText(root[0]));

  const text = sections.map(section => section.text).join('\n');
  const truncated = text.length > SOURCE_LIMITS.maxNormalizedChars;
  const boundedText = truncated ? text.slice(0, SOURCE_LIMITS.maxNormalizedChars) : text;
  const lossRatio = truncated ? 1 - boundedText.length / text.length : 0;
  return {
    language: languageOf(boundedText, metadataLanguage),
    metadataLanguage,
    title,
    primaryHeading,
    sections,
    text: boundedText,
    hash: hash(`${NORMALIZATION_VERSION}\n${boundedText}`),
    lossRatio,
    truncated,
  };
}

function sectionOrder(section: NormalizedSection) {
  return Number(section.key.match(/#(\d+)$/)?.[1] ?? 0);
}

/**
 * Exact blocks first match within their heading context regardless of order. This preserves
 * a plan's identity during a reorder, without cancelling matching text from another plan.
 */
export function diffContent(before: NormalizedContent, after: NormalizedContent): Evidence[] {
  const contexts = new Set([...before.sections, ...after.sections].map(section => section.context));
  const changes: Evidence[] = [];
  for (const context of [...contexts].sort()) {
    const oldSections = before.sections
      .filter(section => section.context === context)
      .sort((a, b) => sectionOrder(a) - sectionOrder(b));
    const newSections = after.sections
      .filter(section => section.context === context)
      .sort((a, b) => sectionOrder(a) - sectionOrder(b));
    const unmatchedOld = new Set(oldSections.map((_, index) => index));
    const unmatchedNew = new Set(newSections.map((_, index) => index));
    for (const [newIndex, next] of newSections.entries()) {
      const oldIndex = oldSections.findIndex(
        (previous, index) => unmatchedOld.has(index) && previous.hash === next.hash,
      );
      if (oldIndex >= 0) {
        unmatchedOld.delete(oldIndex);
        unmatchedNew.delete(newIndex);
      }
    }
    const remainingOld = oldSections.filter((_, index) => unmatchedOld.has(index));
    const remainingNew = newSections.filter((_, index) => unmatchedNew.has(index));
    for (let index = 0; index < Math.max(remainingOld.length, remainingNew.length); index += 1) {
      const oldSection = remainingOld[index];
      const newSection = remainingNew[index];
      const key = newSection?.key ?? oldSection!.key;
      const beforeText = oldSection?.text ?? '';
      const afterText = newSection?.text ?? '';
      const beforeExcerpt = beforeText.slice(0, SOURCE_LIMITS.maxExcerptChars);
      const afterExcerpt = afterText.slice(0, SOURCE_LIMITS.maxExcerptChars);
      changes.push({
        id: hash(`${key}\n${beforeText}\n${afterText}`),
        sectionKey: key,
        beforeText,
        afterText,
        beforeExcerpt,
        afterExcerpt,
        excerptTruncated: beforeText.length > beforeExcerpt.length || afterText.length > afterExcerpt.length,
        kind: !oldSection ? 'added' : !newSection ? 'removed' : 'modified',
      });
    }
  }
  return changes;
}
