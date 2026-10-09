export const HL: {
  inject: (root: Document) => void;
  mk: (tag: 'svg', attrs: Record<string, string>, parent: HTMLElement) => SVGSVGElement;
  tour: (
    stage: HTMLElement,
    stops: ([number, number] | null)[],
    onStop?: (index: number) => void,
  ) => { stop: () => void };
};
