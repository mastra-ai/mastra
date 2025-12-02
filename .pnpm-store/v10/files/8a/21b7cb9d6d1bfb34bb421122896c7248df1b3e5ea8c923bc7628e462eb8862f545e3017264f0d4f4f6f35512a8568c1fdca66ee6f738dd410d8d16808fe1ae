declare module 'css-box-model' {
  export type Position = {
    x: number;
    y: number;
  };

  export type Rect = {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
    x: number;
    y: number;
    center: Position;
  };

  export type BoxModel = {
    marginBox: Rect;
    borderBox: Rect;
    paddingBox: Rect;
    contentBox: Rect;
    border: Spacing;
    padding: Spacing;
    margin: Spacing;
  };

  export type AnyRectType = ClientRect | DOMRect | Rect | Spacing;

  export type Spacing = {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  export const getRect: ({ top, right, bottom, left }: Spacing) => Rect;
  export const expand: (target: Spacing, expandBy: Spacing) => Spacing;
  export const shrink: (target: Spacing, shrinkBy: Spacing) => Spacing;

  type CreateBoxArgs = {
    borderBox: AnyRectType;
    margin?: Spacing;
    border?: Spacing;
    padding?: Spacing;
  };

  export const createBox: (boxArgs: CreateBoxArgs) => BoxModel;
  export const offset: (original: BoxModel, change: Position) => BoxModel;
  export const withScroll: (original: BoxModel, scroll?: Position) => BoxModel;

  export const calculateBox: (
    borderBox: AnyRectType,
    styles: CSSStyleDeclaration,
  ) => BoxModel;

  export const getBox: (el: Element) => BoxModel;
}
