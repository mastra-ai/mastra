import { Direction, ResizeEvent } from "./types.js";
export type ResizeHandlerAction = "down" | "move" | "up";
export type SetResizeHandlerState = (action: ResizeHandlerAction, isActive: boolean, event: ResizeEvent | null) => void;
export type PointerHitAreaMargins = {
    coarse: number;
    fine: number;
};
export type ResizeHandlerData = {
    direction: Direction;
    element: HTMLElement;
    hitAreaMargins: PointerHitAreaMargins;
    setResizeHandlerState: SetResizeHandlerState;
};
export declare const EXCEEDED_HORIZONTAL_MIN = 1;
export declare const EXCEEDED_HORIZONTAL_MAX = 2;
export declare const EXCEEDED_VERTICAL_MIN = 4;
export declare const EXCEEDED_VERTICAL_MAX = 8;
export declare function registerResizeHandle(resizeHandleId: string, element: HTMLElement, direction: Direction, hitAreaMargins: PointerHitAreaMargins, setResizeHandlerState: SetResizeHandlerState): () => void;
export declare function reportConstraintsViolation(resizeHandleId: string, flag: number): void;
