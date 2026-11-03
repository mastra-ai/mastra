/** Every `Message` marks its content with this slot, in Studio and Factory alike. */
const QUOTABLE_SELECTOR = '[data-slot="message-content"]';

/** The selected part of one message's content. */
export interface QuotablePart {
  element: Element;
  range: Range;
  /** The selection also covers text outside this message's content, such as its footer. */
  spills: boolean;
}

/** A point the toolbar is placed against: the first selected line, read live so it follows scrolling. */
export interface QuoteSelectionAnchor {
  getBoundingClientRect: () => DOMRect;
  /** Lets the positioner find the scroll containers it has to follow. */
  contextElement: Element;
}

const visibleText = (value: string) => value.replace(/\s+/g, '');

/** The part of `range` inside `element`. */
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

/**
 * The one message content inside `container` that holds the selected text. A selection with text in
 * two messages quotes neither, so it returns `undefined`.
 */
export function findQuotablePart(container: Element, range: Range): QuotablePart | undefined {
  if (!range.intersectsNode(container)) return undefined;
  const selected = visibleText(range.toString());
  if (!selected) return undefined;

  const touched = Array.from(container.querySelectorAll(QUOTABLE_SELECTOR)).filter(element =>
    range.intersectsNode(element),
  );
  // A message nested in another one's content (a subagent transcript) belongs to the outer quote.
  const outermost = touched.filter(element => !touched.some(other => other !== element && other.contains(element)));
  const withText = outermost
    .map(element => ({ element, range: rangeWithin(range, element) }))
    .filter(part => visibleText(part.range.toString()));
  const [part, other] = withText;
  if (!part || other) return undefined;

  return { ...part, spills: visibleText(part.range.toString()) !== selected };
}

function isBackward(selection: Selection): boolean {
  const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
  if (!anchorNode || !focusNode) return false;
  const anchor = anchorNode.ownerDocument?.createRange();
  if (!anchor) return false;
  anchor.setStart(anchorNode, anchorOffset);
  return anchor.comparePoint(focusNode, focusOffset) < 0;
}

/** Trims the visible selection to the message, keeping its direction, so what is highlighted is what gets quoted. */
export function clampSelection(selection: Selection, part: QuotablePart) {
  const { startContainer, startOffset, endContainer, endOffset } = part.range;
  if (isBackward(selection)) selection.setBaseAndExtent(endContainer, endOffset, startContainer, startOffset);
  else selection.setBaseAndExtent(startContainer, startOffset, endContainer, endOffset);
}

const lineRects = (range: Range) =>
  Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);

export function quoteSelectionAnchor(part: QuotablePart): QuoteSelectionAnchor {
  return {
    getBoundingClientRect: () => lineRects(part.range)[0] ?? part.range.getBoundingClientRect(),
    contextElement: part.element,
  };
}

/**
 * Where a quote sits: the message content it came from and the character span of its text there.
 * Offsets rather than a `Range`, so the mark survives the message re-rendering its text nodes.
 */
export interface QuoteSource {
  element: Element;
  start: number;
  end: number;
}

function textOffset(element: Element, node: Node, offset: number): number {
  const before = element.ownerDocument.createRange();
  before.selectNodeContents(element);
  before.setEnd(node, offset);
  return before.toString().length;
}

export function quoteSource({ element, range }: QuotablePart): QuoteSource {
  return {
    element,
    start: textOffset(element, range.startContainer, range.startOffset),
    end: textOffset(element, range.endContainer, range.endOffset),
  };
}

/** The quoted text as it is laid out now, or `undefined` once its message left the page or lost that text. */
export function rangeFromSource({ element, start, end }: QuoteSource): Range | undefined {
  if (!element.isConnected) return undefined;
  const document = element.ownerDocument;
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && start <= seen + length) {
      range.setStart(node, start - seen);
      started = true;
    }
    if (started && end <= seen + length) {
      range.setEnd(node, end - seen);
      return range;
    }
    seen += length;
  }
  return undefined;
}

/** The end of the quote's last line, where its number sits like a footnote mark. */
export function quoteEndRect(range: Range): DOMRect | undefined {
  return lineRects(range).at(-1);
}
