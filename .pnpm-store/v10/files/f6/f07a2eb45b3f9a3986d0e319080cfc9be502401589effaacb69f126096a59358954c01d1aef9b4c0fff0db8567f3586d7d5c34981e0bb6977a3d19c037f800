import { pointer } from 'd3-selection';
import type { CoordinateExtent, PanZoomInstance, Transform } from '../types';
export type XYMinimapInstance = {
    update: (params: XYMinimapUpdate) => void;
    destroy: () => void;
    pointer: typeof pointer;
};
export type XYMinimapParams = {
    panZoom: PanZoomInstance;
    domNode: Element;
    getTransform: () => Transform;
    getViewScale: () => number;
};
export type XYMinimapUpdate = {
    translateExtent: CoordinateExtent;
    width: number;
    height: number;
    inversePan?: boolean;
    zoomStep?: number;
    pannable?: boolean;
    zoomable?: boolean;
};
export declare function XYMinimap({ domNode, panZoom, getTransform, getViewScale }: XYMinimapParams): {
    update: ({ translateExtent, width, height, zoomStep, pannable, zoomable, inversePan, }: XYMinimapUpdate) => void;
    destroy: () => void;
    pointer: typeof pointer;
};
//# sourceMappingURL=index.d.ts.map