import { CSSProperties, HTMLAttributes, PropsWithChildren, ReactElement } from "react";
import { PointerHitAreaMargins } from "./PanelResizeHandleRegistry.js";
export type PanelResizeHandleOnDragging = (isDragging: boolean) => void;
export type ResizeHandlerState = "drag" | "hover" | "inactive";
export type PanelResizeHandleProps = Omit<HTMLAttributes<keyof HTMLElementTagNameMap>, "id" | "onBlur" | "onClick" | "onFocus" | "onPointerDown" | "onPointerUp"> & PropsWithChildren<{
    className?: string;
    disabled?: boolean;
    hitAreaMargins?: PointerHitAreaMargins;
    id?: string | null;
    onBlur?: () => void;
    onClick?: () => void;
    onDragging?: PanelResizeHandleOnDragging;
    onFocus?: () => void;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
    style?: CSSProperties;
    tabIndex?: number;
    tagName?: keyof HTMLElementTagNameMap;
}>;
export declare function PanelResizeHandle({ children, className: classNameFromProps, disabled, hitAreaMargins, id: idFromProps, onBlur, onClick, onDragging, onFocus, onPointerDown, onPointerUp, style: styleFromProps, tabIndex, tagName: Type, ...rest }: PanelResizeHandleProps): ReactElement;
export declare namespace PanelResizeHandle {
    var displayName: string;
}
