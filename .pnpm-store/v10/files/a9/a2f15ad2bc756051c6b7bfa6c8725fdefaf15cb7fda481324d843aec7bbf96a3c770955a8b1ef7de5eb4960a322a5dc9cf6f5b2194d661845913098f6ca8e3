import type { D3ZoomEvent } from 'd3-zoom';
import { PanOnScrollMode, type D3SelectionInstance, type D3ZoomHandler, type D3ZoomInstance, type OnPanZoom, type OnDraggingChange, type OnTransformChange } from '../types';
import { ZoomPanValues } from './XYPanZoom';
export type PanOnScrollParams = {
    zoomPanValues: ZoomPanValues;
    noWheelClassName: string;
    d3Selection: D3SelectionInstance;
    d3Zoom: D3ZoomInstance;
    panOnScrollMode: PanOnScrollMode;
    panOnScrollSpeed: number;
    zoomOnPinch: boolean;
    onPanZoomStart?: OnPanZoom;
    onPanZoom?: OnPanZoom;
    onPanZoomEnd?: OnPanZoom;
};
export type ZoomOnScrollParams = {
    noWheelClassName: string;
    preventScrolling: boolean;
    d3ZoomHandler: D3ZoomHandler;
};
export type PanZoomStartParams = {
    zoomPanValues: ZoomPanValues;
    onDraggingChange: OnDraggingChange;
    onPanZoomStart?: OnPanZoom;
};
export type PanZoomParams = {
    zoomPanValues: ZoomPanValues;
    panOnDrag: boolean | number[];
    onPaneContextMenu: boolean;
    onTransformChange: OnTransformChange;
    onPanZoom?: OnPanZoom;
};
export type PanZoomEndParams = {
    zoomPanValues: ZoomPanValues;
    panOnDrag: boolean | number[];
    panOnScroll: boolean;
    onDraggingChange: (isDragging: boolean) => void;
    onPanZoomEnd?: OnPanZoom;
    onPaneContextMenu?: (event: any) => void;
};
export declare function createPanOnScrollHandler({ zoomPanValues, noWheelClassName, d3Selection, d3Zoom, panOnScrollMode, panOnScrollSpeed, zoomOnPinch, onPanZoomStart, onPanZoom, onPanZoomEnd, }: PanOnScrollParams): (event: any) => false | undefined;
export declare function createZoomOnScrollHandler({ noWheelClassName, preventScrolling, d3ZoomHandler }: ZoomOnScrollParams): (this: Element, event: any, d: unknown) => null | undefined;
export declare function createPanZoomStartHandler({ zoomPanValues, onDraggingChange, onPanZoomStart }: PanZoomStartParams): (event: D3ZoomEvent<HTMLDivElement, any>) => void;
export declare function createPanZoomHandler({ zoomPanValues, panOnDrag, onPaneContextMenu, onTransformChange, onPanZoom, }: PanZoomParams): (event: D3ZoomEvent<HTMLDivElement, any>) => void;
export declare function createPanZoomEndHandler({ zoomPanValues, panOnDrag, panOnScroll, onDraggingChange, onPanZoomEnd, onPaneContextMenu, }: PanZoomEndParams): (event: D3ZoomEvent<HTMLDivElement, any>) => void;
//# sourceMappingURL=eventhandler.d.ts.map