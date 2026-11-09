import { escapeRegExp } from '@/lib/string';

/** Every `Message` marks its content with this slot, in Studio and Factory alike. */
const ANNOTATABLE_SELECTOR = '[data-slot="message-content"]';

export interface AnnotatablePart {
  element: Element;
  range: Range;
  extendsPastContent: boolean;
}

export interface SelectionAnchor {
  getBoundingClientRect: () => DOMRect;
  /** Lets the positioner find the scroll containers it has to follow. */
  contextElement: Element;
}

const visibleText = (value: string) => value.replace(/\s+/g, '');

function rangeWithin(range: Range, element: Element): Range {
  const within = element.ownerDocument.createRange();
  within.selectNodeContents(element);
  if (range.compareBoundaryPoints(Range.START_TO_START, within) > 0) {
    within.setStart(range.startContainer, range.startOffset);
  }
  if (range.compareBoundaryPoints(Range.END_TO_END, within) < 0) {
    within.setEnd(range.endContainer, range.endOffset);
  }
  return within;
}

const isOutermostMessage = (element: Element) => !element.parentElement?.closest(ANNOTATABLE_SELECTOR);

export function findAnnotatablePart(container: Element, range: Range): AnnotatablePart | undefined {
  if (!range.intersectsNode(container)) return undefined;
  const selected = visibleText(range.toString());
  if (!selected) return undefined;

  const withText = Array.from(container.querySelectorAll(ANNOTATABLE_SELECTOR))
    .filter(element => range.intersectsNode(element) && isOutermostMessage(element))
    .map(element => ({ element, range: rangeWithin(range, element) }))
    .filter(part => visibleText(part.range.toString()));
  const [part, other] = withText;
  if (!part || other) return undefined;

  return { ...part, extendsPastContent: visibleText(part.range.toString()) !== selected };
}

function isBackward(selection: Selection): boolean {
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  if (!anchorNode || !focusNode) return false;
  const anchor = anchorNode.ownerDocument?.createRange();
  if (!anchor) return false;
  anchor.setStart(anchorNode, anchorOffset);
  return anchor.comparePoint(focusNode, focusOffset) < 0;
}

export function clampSelection(selection: Selection, part: AnnotatablePart) {
  const { startContainer, startOffset, endContainer, endOffset } = part.range;
  if (isBackward(selection)) selection.setBaseAndExtent(endContainer, endOffset, startContainer, startOffset);
  else selection.setBaseAndExtent(startContainer, startOffset, endContainer, endOffset);
}

const lineRects = (range: Range) =>
  Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);

export function selectionAnchor(part: AnnotatablePart): SelectionAnchor {
  return {
    getBoundingClientRect: () => lineRects(part.range)[0] ?? part.range.getBoundingClientRect(),
    contextElement: part.element,
  };
}

/** Offsets rather than a `Range`, so the mark survives the message re-rendering its text nodes. */
export interface AnnotationSource {
  element: Element;
  start: number;
  end: number;
  text: string;
  textBefore: string;
  textAfter: string;
}

interface Span {
  start: number;
  end: number;
}

const SURROUNDING_VISIBLE_CHARS = 16;

function surroundings(content: string, { start, end }: Span) {
  return {
    textBefore: visibleText(content.slice(0, start)).slice(-SURROUNDING_VISIBLE_CHARS),
    textAfter: visibleText(content.slice(end)).slice(0, SURROUNDING_VISIBLE_CHARS),
  };
}

function textOffset(element: Element, node: Node, offset: number): number {
  const before = element.ownerDocument.createRange();
  before.selectNodeContents(element);
  before.setEnd(node, offset);
  return before.toString().length;
}

export function annotationSource({ element, range }: AnnotatablePart): AnnotationSource {
  const span = {
    start: textOffset(element, range.startContainer, range.startOffset),
    end: textOffset(element, range.endContainer, range.endOffset),
  };
  return { element, ...span, text: visibleText(range.toString()), ...surroundings(element.textContent ?? '', span) };
}

function passagePattern(text: string): RegExp {
  return new RegExp(Array.from(text, escapeRegExp).join('\\s*'), 'g');
}

function locate(element: Element, source: AnnotationSource): Span | undefined {
  const content = element.textContent ?? '';
  const surroundingsAgree = (span: Span) => {
    const now = surroundings(content, span);
    return now.textBefore === source.textBefore || now.textAfter === source.textAfter;
  };
  const saved = { start: source.start, end: source.end };
  if (visibleText(content.slice(saved.start, saved.end)) === source.text && surroundingsAgree(saved)) return saved;
  const copies = Array.from(content.matchAll(passagePattern(source.text)), match => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  if (copies.length <= 1) return copies[0];
  const distance = (copy: Span) => Math.abs(copy.start - source.start);
  return copies.filter(surroundingsAgree).toSorted((a, b) => distance(a) - distance(b))[0];
}

export function rangeFromSource(source: AnnotationSource): Range | undefined {
  const { element } = source;
  if (!element.isConnected) return undefined;
  const span = locate(element, source);
  if (!span) return undefined;
  const document = element.ownerDocument;
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && span.start < seen + length) {
      range.setStart(node, span.start - seen);
      started = true;
    }
    if (started && span.end <= seen + length) {
      range.setEnd(node, span.end - seen);
      return range;
    }
    seen += length;
  }
  return undefined;
}

export function passageEndRect(range: Range): DOMRect | undefined {
  return lineRects(range).at(-1);
}
