/// <reference types="react" />
import * as React$1 from 'react';
import { CSSProperties, PropsWithoutRef, RefAttributes, JSX, SVGAttributes } from 'react';
import { MotionNodeOptions, MotionValue, TransformProperties, SVGPathProperties, Batcher } from 'motion-dom';

type MotionValueString = MotionValue<string>;
type MotionValueNumber = MotionValue<number>;
type MotionValueAny = MotionValue<any>;
type AnyMotionValue = MotionValueNumber | MotionValueString | MotionValueAny;
type MotionValueHelper<T> = T | AnyMotionValue;
type MakeMotionHelper<T> = {
    [K in keyof T]: MotionValueHelper<T[K]>;
};
type MakeCustomValueTypeHelper<T> = MakeMotionHelper<T>;
type MakeMotion<T> = MakeCustomValueTypeHelper<T>;
type MotionCSS = MakeMotion<Omit<CSSProperties, "rotate" | "scale" | "perspective">>;
/**
 * @public
 */
type MotionTransform = MakeMotion<TransformProperties>;
type MotionSVGProps = MakeMotion<SVGPathProperties>;
/**
 * @public
 */
interface MotionStyle$1 extends MotionCSS, MotionTransform, MotionSVGProps {
}
/**
 * Props for `motion` components.
 *
 * @public
 */
interface MotionProps extends MotionNodeOptions {
    /**
     *
     * The React DOM `style` prop, enhanced with support for `MotionValue`s and separate `transform` values.
     *
     * ```jsx
     * export const MyComponent = () => {
     *   const x = useMotionValue(0)
     *
     *   return <motion.div style={{ x, opacity: 1, scale: 0.5 }} />
     * }
     * ```
     */
    style?: MotionStyle$1;
    children?: React.ReactNode | MotionValueNumber | MotionValueString;
}

interface HTMLElements {
    a: HTMLAnchorElement;
    abbr: HTMLElement;
    address: HTMLElement;
    area: HTMLAreaElement;
    article: HTMLElement;
    aside: HTMLElement;
    audio: HTMLAudioElement;
    b: HTMLElement;
    base: HTMLBaseElement;
    bdi: HTMLElement;
    bdo: HTMLElement;
    big: HTMLElement;
    blockquote: HTMLQuoteElement;
    body: HTMLBodyElement;
    br: HTMLBRElement;
    button: HTMLButtonElement;
    canvas: HTMLCanvasElement;
    caption: HTMLElement;
    center: HTMLElement;
    cite: HTMLElement;
    code: HTMLElement;
    col: HTMLTableColElement;
    colgroup: HTMLTableColElement;
    data: HTMLDataElement;
    datalist: HTMLDataListElement;
    dd: HTMLElement;
    del: HTMLModElement;
    details: HTMLDetailsElement;
    dfn: HTMLElement;
    dialog: HTMLDialogElement;
    div: HTMLDivElement;
    dl: HTMLDListElement;
    dt: HTMLElement;
    em: HTMLElement;
    embed: HTMLEmbedElement;
    fieldset: HTMLFieldSetElement;
    figcaption: HTMLElement;
    figure: HTMLElement;
    footer: HTMLElement;
    form: HTMLFormElement;
    h1: HTMLHeadingElement;
    h2: HTMLHeadingElement;
    h3: HTMLHeadingElement;
    h4: HTMLHeadingElement;
    h5: HTMLHeadingElement;
    h6: HTMLHeadingElement;
    head: HTMLHeadElement;
    header: HTMLElement;
    hgroup: HTMLElement;
    hr: HTMLHRElement;
    html: HTMLHtmlElement;
    i: HTMLElement;
    iframe: HTMLIFrameElement;
    img: HTMLImageElement;
    input: HTMLInputElement;
    ins: HTMLModElement;
    kbd: HTMLElement;
    keygen: HTMLElement;
    label: HTMLLabelElement;
    legend: HTMLLegendElement;
    li: HTMLLIElement;
    link: HTMLLinkElement;
    main: HTMLElement;
    map: HTMLMapElement;
    mark: HTMLElement;
    menu: HTMLElement;
    menuitem: HTMLElement;
    meta: HTMLMetaElement;
    meter: HTMLMeterElement;
    nav: HTMLElement;
    noindex: HTMLElement;
    noscript: HTMLElement;
    object: HTMLObjectElement;
    ol: HTMLOListElement;
    optgroup: HTMLOptGroupElement;
    option: HTMLOptionElement;
    output: HTMLOutputElement;
    p: HTMLParagraphElement;
    param: HTMLParamElement;
    picture: HTMLElement;
    pre: HTMLPreElement;
    progress: HTMLProgressElement;
    q: HTMLQuoteElement;
    rp: HTMLElement;
    rt: HTMLElement;
    ruby: HTMLElement;
    s: HTMLElement;
    samp: HTMLElement;
    search: HTMLElement;
    slot: HTMLSlotElement;
    script: HTMLScriptElement;
    section: HTMLElement;
    select: HTMLSelectElement;
    small: HTMLElement;
    source: HTMLSourceElement;
    span: HTMLSpanElement;
    strong: HTMLElement;
    style: HTMLStyleElement;
    sub: HTMLElement;
    summary: HTMLElement;
    sup: HTMLElement;
    table: HTMLTableElement;
    template: HTMLTemplateElement;
    tbody: HTMLTableSectionElement;
    td: HTMLTableDataCellElement;
    textarea: HTMLTextAreaElement;
    tfoot: HTMLTableSectionElement;
    th: HTMLTableHeaderCellElement;
    thead: HTMLTableSectionElement;
    time: HTMLTimeElement;
    title: HTMLTitleElement;
    tr: HTMLTableRowElement;
    track: HTMLTrackElement;
    u: HTMLElement;
    ul: HTMLUListElement;
    var: HTMLElement;
    video: HTMLVideoElement;
    wbr: HTMLElement;
    webview: HTMLWebViewElement;
}

/**
 * @public
 */
type ForwardRefComponent<T, P> = {
    readonly $$typeof: symbol;
} & ((props: PropsWithoutRef<P> & RefAttributes<T>) => JSX.Element);
type AttributesWithoutMotionProps<Attributes> = {
    [K in Exclude<keyof Attributes, keyof MotionProps>]?: Attributes[K];
};
/**
 * @public
 */
type HTMLMotionProps<Tag extends keyof HTMLElements> = AttributesWithoutMotionProps<JSX.IntrinsicElements[Tag]> & MotionProps;
/**
 * Motion-optimised versions of React's HTML components.
 *
 * @public
 */
type HTMLMotionComponents = {
    [K in keyof HTMLElements]: ForwardRefComponent<HTMLElements[K], HTMLMotionProps<K>>;
};

type UnionStringArray<T extends Readonly<string[]>> = T[number];
declare const svgElements: readonly ["animate", "circle", "defs", "desc", "ellipse", "g", "image", "line", "filter", "marker", "mask", "metadata", "path", "pattern", "polygon", "polyline", "rect", "stop", "svg", "switch", "symbol", "text", "tspan", "use", "view", "clipPath", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence", "foreignObject", "linearGradient", "radialGradient", "textPath"];
type SVGElements = UnionStringArray<typeof svgElements>;

interface SVGAttributesWithoutMotionProps<T> extends Pick<SVGAttributes<T>, Exclude<keyof SVGAttributes<T>, keyof MotionProps>> {
}
/**
 * Blanket-accept any SVG attribute as a `MotionValue`
 * @public
 */
type SVGAttributesAsMotionValues<T> = MakeMotion<SVGAttributesWithoutMotionProps<T>>;
type UnwrapSVGFactoryElement<F> = F extends React.SVGProps<infer P> ? P : never;
/**
 * @public
 */
interface SVGMotionProps<T> extends SVGAttributesAsMotionValues<T>, MotionProps {
}
/**
 * Motion-optimised versions of React's SVG components.
 *
 * @public
 */
type SVGMotionComponents = {
    [K in SVGElements]: ForwardRefComponent<UnwrapSVGFactoryElement<JSX.IntrinsicElements[K]>, SVGMotionProps<UnwrapSVGFactoryElement<JSX.IntrinsicElements[K]>>>;
};

type DOMMotionComponents = HTMLMotionComponents & SVGMotionComponents;

type MotionComponentProps<Props> = {
    [K in Exclude<keyof Props, keyof MotionProps>]?: Props[K];
} & MotionProps;
type MotionComponent<T, P> = T extends keyof DOMMotionComponents ? DOMMotionComponents[T] : React$1.ComponentType<Omit<MotionComponentProps<P>, "children"> & {
    children?: "children" extends keyof P ? P["children"] | MotionComponentProps<P>["children"] : MotionComponentProps<P>["children"];
}>;
interface MotionComponentOptions {
    forwardMotionProps?: boolean;
}

declare function createMinimalMotionComponent<Props, TagName extends keyof DOMMotionComponents | string = "div">(Component: TagName | string | React.ComponentType<Props>, options?: MotionComponentOptions): MotionComponent<TagName, Props>;

declare const optimizedAppearDataAttribute: "data-framer-appear-id";

/**
 * Expose only the needed part of the VisualElement interface to
 * ensure React types don't end up in the generic DOM bundle.
 */
interface WithAppearProps {
    props: {
        [optimizedAppearDataAttribute]?: string;
        values?: {
            [key: string]: MotionValue<number> | MotionValue<string>;
        };
    };
}
type HandoffFunction = (storeId: string, valueName: string, frame: Batcher) => number | null;
/**
 * The window global object acts as a bridge between our inline script
 * triggering the optimized appear animations, and Motion.
 */
declare global {
    interface Window {
        MotionHandoffAnimation?: HandoffFunction;
        MotionHandoffMarkAsComplete?: (elementId: string) => void;
        MotionHandoffIsComplete?: (elementId: string) => boolean;
        MotionHasOptimisedAnimation?: (elementId?: string, valueName?: string) => boolean;
        MotionCancelOptimisedAnimation?: (elementId?: string, valueName?: string, frame?: Batcher, canResume?: boolean) => void;
        MotionCheckAppearSync?: (visualElement: WithAppearProps, valueName: string, value: MotionValue) => VoidFunction | void;
        MotionIsMounted?: boolean;
    }
}

/**
 * HTML components
 */
declare const MotionA: ForwardRefComponent<HTMLAnchorElement, HTMLMotionProps<"a">>;
declare const MotionAbbr: ForwardRefComponent<HTMLElement, HTMLMotionProps<"abbr">>;
declare const MotionAddress: ForwardRefComponent<HTMLElement, HTMLMotionProps<"address">>;
declare const MotionArea: ForwardRefComponent<HTMLAreaElement, HTMLMotionProps<"area">>;
declare const MotionArticle: ForwardRefComponent<HTMLElement, HTMLMotionProps<"article">>;
declare const MotionAside: ForwardRefComponent<HTMLElement, HTMLMotionProps<"aside">>;
declare const MotionAudio: ForwardRefComponent<HTMLAudioElement, HTMLMotionProps<"audio">>;
declare const MotionB: ForwardRefComponent<HTMLElement, HTMLMotionProps<"b">>;
declare const MotionBase: ForwardRefComponent<HTMLBaseElement, HTMLMotionProps<"base">>;
declare const MotionBdi: ForwardRefComponent<HTMLElement, HTMLMotionProps<"bdi">>;
declare const MotionBdo: ForwardRefComponent<HTMLElement, HTMLMotionProps<"bdo">>;
declare const MotionBig: ForwardRefComponent<HTMLElement, HTMLMotionProps<"big">>;
declare const MotionBlockquote: ForwardRefComponent<HTMLQuoteElement, HTMLMotionProps<"blockquote">>;
declare const MotionBody: ForwardRefComponent<HTMLBodyElement, HTMLMotionProps<"body">>;
declare const MotionButton: ForwardRefComponent<HTMLButtonElement, HTMLMotionProps<"button">>;
declare const MotionCanvas: ForwardRefComponent<HTMLCanvasElement, HTMLMotionProps<"canvas">>;
declare const MotionCaption: ForwardRefComponent<HTMLElement, HTMLMotionProps<"caption">>;
declare const MotionCite: ForwardRefComponent<HTMLElement, HTMLMotionProps<"cite">>;
declare const MotionCode: ForwardRefComponent<HTMLElement, HTMLMotionProps<"code">>;
declare const MotionCol: ForwardRefComponent<HTMLTableColElement, HTMLMotionProps<"col">>;
declare const MotionColgroup: ForwardRefComponent<HTMLTableColElement, HTMLMotionProps<"colgroup">>;
declare const MotionData: ForwardRefComponent<HTMLDataElement, HTMLMotionProps<"data">>;
declare const MotionDatalist: ForwardRefComponent<HTMLDataListElement, HTMLMotionProps<"datalist">>;
declare const MotionDd: ForwardRefComponent<HTMLElement, HTMLMotionProps<"dd">>;
declare const MotionDel: ForwardRefComponent<HTMLModElement, HTMLMotionProps<"del">>;
declare const MotionDetails: ForwardRefComponent<HTMLDetailsElement, HTMLMotionProps<"details">>;
declare const MotionDfn: ForwardRefComponent<HTMLElement, HTMLMotionProps<"dfn">>;
declare const MotionDialog: ForwardRefComponent<HTMLDialogElement, HTMLMotionProps<"dialog">>;
declare const MotionDiv: ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>;
declare const MotionDl: ForwardRefComponent<HTMLDListElement, HTMLMotionProps<"dl">>;
declare const MotionDt: ForwardRefComponent<HTMLElement, HTMLMotionProps<"dt">>;
declare const MotionEm: ForwardRefComponent<HTMLElement, HTMLMotionProps<"em">>;
declare const MotionEmbed: ForwardRefComponent<HTMLEmbedElement, HTMLMotionProps<"embed">>;
declare const MotionFieldset: ForwardRefComponent<HTMLFieldSetElement, HTMLMotionProps<"fieldset">>;
declare const MotionFigcaption: ForwardRefComponent<HTMLElement, HTMLMotionProps<"figcaption">>;
declare const MotionFigure: ForwardRefComponent<HTMLElement, HTMLMotionProps<"figure">>;
declare const MotionFooter: ForwardRefComponent<HTMLElement, HTMLMotionProps<"footer">>;
declare const MotionForm: ForwardRefComponent<HTMLFormElement, HTMLMotionProps<"form">>;
declare const MotionH1: ForwardRefComponent<HTMLHeadingElement, HTMLMotionProps<"h1">>;
declare const MotionH2: ForwardRefComponent<HTMLHeadingElement, HTMLMotionProps<"h2">>;
declare const MotionH3: ForwardRefComponent<HTMLHeadingElement, HTMLMotionProps<"h3">>;
declare const MotionH4: ForwardRefComponent<HTMLHeadingElement, HTMLMotionProps<"h4">>;
declare const MotionH5: ForwardRefComponent<HTMLHeadingElement, HTMLMotionProps<"h5">>;
declare const MotionH6: ForwardRefComponent<HTMLHeadingElement, HTMLMotionProps<"h6">>;
declare const MotionHead: ForwardRefComponent<HTMLHeadElement, HTMLMotionProps<"head">>;
declare const MotionHeader: ForwardRefComponent<HTMLElement, HTMLMotionProps<"header">>;
declare const MotionHgroup: ForwardRefComponent<HTMLElement, HTMLMotionProps<"hgroup">>;
declare const MotionHr: ForwardRefComponent<HTMLHRElement, HTMLMotionProps<"hr">>;
declare const MotionHtml: ForwardRefComponent<HTMLHtmlElement, HTMLMotionProps<"html">>;
declare const MotionI: ForwardRefComponent<HTMLElement, HTMLMotionProps<"i">>;
declare const MotionIframe: ForwardRefComponent<HTMLIFrameElement, HTMLMotionProps<"iframe">>;
declare const MotionImg: ForwardRefComponent<HTMLImageElement, HTMLMotionProps<"img">>;
declare const MotionInput: ForwardRefComponent<HTMLInputElement, HTMLMotionProps<"input">>;
declare const MotionIns: ForwardRefComponent<HTMLModElement, HTMLMotionProps<"ins">>;
declare const MotionKbd: ForwardRefComponent<HTMLElement, HTMLMotionProps<"kbd">>;
declare const MotionKeygen: ForwardRefComponent<HTMLElement, HTMLMotionProps<"keygen">>;
declare const MotionLabel: ForwardRefComponent<HTMLLabelElement, HTMLMotionProps<"label">>;
declare const MotionLegend: ForwardRefComponent<HTMLLegendElement, HTMLMotionProps<"legend">>;
declare const MotionLi: ForwardRefComponent<HTMLLIElement, HTMLMotionProps<"li">>;
declare const MotionLink: ForwardRefComponent<HTMLLinkElement, HTMLMotionProps<"link">>;
declare const MotionMain: ForwardRefComponent<HTMLElement, HTMLMotionProps<"main">>;
declare const MotionMap: ForwardRefComponent<HTMLMapElement, HTMLMotionProps<"map">>;
declare const MotionMark: ForwardRefComponent<HTMLElement, HTMLMotionProps<"mark">>;
declare const MotionMenu: ForwardRefComponent<HTMLElement, HTMLMotionProps<"menu">>;
declare const MotionMenuitem: ForwardRefComponent<HTMLElement, HTMLMotionProps<"menuitem">>;
declare const MotionMeter: ForwardRefComponent<HTMLMeterElement, HTMLMotionProps<"meter">>;
declare const MotionNav: ForwardRefComponent<HTMLElement, HTMLMotionProps<"nav">>;
declare const MotionObject: ForwardRefComponent<HTMLObjectElement, HTMLMotionProps<"object">>;
declare const MotionOl: ForwardRefComponent<HTMLOListElement, HTMLMotionProps<"ol">>;
declare const MotionOptgroup: ForwardRefComponent<HTMLOptGroupElement, HTMLMotionProps<"optgroup">>;
declare const MotionOption: ForwardRefComponent<HTMLOptionElement, HTMLMotionProps<"option">>;
declare const MotionOutput: ForwardRefComponent<HTMLOutputElement, HTMLMotionProps<"output">>;
declare const MotionP: ForwardRefComponent<HTMLParagraphElement, HTMLMotionProps<"p">>;
declare const MotionParam: ForwardRefComponent<HTMLParamElement, HTMLMotionProps<"param">>;
declare const MotionPicture: ForwardRefComponent<HTMLElement, HTMLMotionProps<"picture">>;
declare const MotionPre: ForwardRefComponent<HTMLPreElement, HTMLMotionProps<"pre">>;
declare const MotionProgress: ForwardRefComponent<HTMLProgressElement, HTMLMotionProps<"progress">>;
declare const MotionQ: ForwardRefComponent<HTMLQuoteElement, HTMLMotionProps<"q">>;
declare const MotionRp: ForwardRefComponent<HTMLElement, HTMLMotionProps<"rp">>;
declare const MotionRt: ForwardRefComponent<HTMLElement, HTMLMotionProps<"rt">>;
declare const MotionRuby: ForwardRefComponent<HTMLElement, HTMLMotionProps<"ruby">>;
declare const MotionS: ForwardRefComponent<HTMLElement, HTMLMotionProps<"s">>;
declare const MotionSamp: ForwardRefComponent<HTMLElement, HTMLMotionProps<"samp">>;
declare const MotionScript: ForwardRefComponent<HTMLScriptElement, HTMLMotionProps<"script">>;
declare const MotionSection: ForwardRefComponent<HTMLElement, HTMLMotionProps<"section">>;
declare const MotionSelect: ForwardRefComponent<HTMLSelectElement, HTMLMotionProps<"select">>;
declare const MotionSmall: ForwardRefComponent<HTMLElement, HTMLMotionProps<"small">>;
declare const MotionSource: ForwardRefComponent<HTMLSourceElement, HTMLMotionProps<"source">>;
declare const MotionSpan: ForwardRefComponent<HTMLSpanElement, HTMLMotionProps<"span">>;
declare const MotionStrong: ForwardRefComponent<HTMLElement, HTMLMotionProps<"strong">>;
declare const MotionStyle: ForwardRefComponent<HTMLStyleElement, HTMLMotionProps<"style">>;
declare const MotionSub: ForwardRefComponent<HTMLElement, HTMLMotionProps<"sub">>;
declare const MotionSummary: ForwardRefComponent<HTMLElement, HTMLMotionProps<"summary">>;
declare const MotionSup: ForwardRefComponent<HTMLElement, HTMLMotionProps<"sup">>;
declare const MotionTable: ForwardRefComponent<HTMLTableElement, HTMLMotionProps<"table">>;
declare const MotionTbody: ForwardRefComponent<HTMLTableSectionElement, HTMLMotionProps<"tbody">>;
declare const MotionTd: ForwardRefComponent<HTMLTableDataCellElement, HTMLMotionProps<"td">>;
declare const MotionTextarea: ForwardRefComponent<HTMLTextAreaElement, HTMLMotionProps<"textarea">>;
declare const MotionTfoot: ForwardRefComponent<HTMLTableSectionElement, HTMLMotionProps<"tfoot">>;
declare const MotionTh: ForwardRefComponent<HTMLTableHeaderCellElement, HTMLMotionProps<"th">>;
declare const MotionThead: ForwardRefComponent<HTMLTableSectionElement, HTMLMotionProps<"thead">>;
declare const MotionTime: ForwardRefComponent<HTMLTimeElement, HTMLMotionProps<"time">>;
declare const MotionTitle: ForwardRefComponent<HTMLTitleElement, HTMLMotionProps<"title">>;
declare const MotionTr: ForwardRefComponent<HTMLTableRowElement, HTMLMotionProps<"tr">>;
declare const MotionTrack: ForwardRefComponent<HTMLTrackElement, HTMLMotionProps<"track">>;
declare const MotionU: ForwardRefComponent<HTMLElement, HTMLMotionProps<"u">>;
declare const MotionUl: ForwardRefComponent<HTMLUListElement, HTMLMotionProps<"ul">>;
declare const MotionVideo: ForwardRefComponent<HTMLVideoElement, HTMLMotionProps<"video">>;
declare const MotionWbr: ForwardRefComponent<HTMLElement, HTMLMotionProps<"wbr">>;
declare const MotionWebview: ForwardRefComponent<HTMLWebViewElement, HTMLMotionProps<"webview">>;
/**
 * SVG components
 */
declare const MotionAnimate: ForwardRefComponent<SVGElement, SVGMotionProps<SVGElement>>;
declare const MotionCircle: ForwardRefComponent<SVGCircleElement, SVGMotionProps<SVGCircleElement>>;
declare const MotionDefs: ForwardRefComponent<SVGDefsElement, SVGMotionProps<SVGDefsElement>>;
declare const MotionDesc: ForwardRefComponent<SVGDescElement, SVGMotionProps<SVGDescElement>>;
declare const MotionEllipse: ForwardRefComponent<SVGEllipseElement, SVGMotionProps<SVGEllipseElement>>;
declare const MotionG: ForwardRefComponent<SVGGElement, SVGMotionProps<SVGGElement>>;
declare const MotionImage: ForwardRefComponent<SVGImageElement, SVGMotionProps<SVGImageElement>>;
declare const MotionLine: ForwardRefComponent<SVGLineElement, SVGMotionProps<SVGLineElement>>;
declare const MotionFilter: ForwardRefComponent<SVGFilterElement, SVGMotionProps<SVGFilterElement>>;
declare const MotionMarker: ForwardRefComponent<SVGMarkerElement, SVGMotionProps<SVGMarkerElement>>;
declare const MotionMask: ForwardRefComponent<SVGMaskElement, SVGMotionProps<SVGMaskElement>>;
declare const MotionMetadata: ForwardRefComponent<SVGMetadataElement, SVGMotionProps<SVGMetadataElement>>;
declare const MotionPath: ForwardRefComponent<SVGPathElement, SVGMotionProps<SVGPathElement>>;
declare const MotionPattern: ForwardRefComponent<SVGPatternElement, SVGMotionProps<SVGPatternElement>>;
declare const MotionPolygon: ForwardRefComponent<SVGPolygonElement, SVGMotionProps<SVGPolygonElement>>;
declare const MotionPolyline: ForwardRefComponent<SVGPolylineElement, SVGMotionProps<SVGPolylineElement>>;
declare const MotionRect: ForwardRefComponent<SVGRectElement, SVGMotionProps<SVGRectElement>>;
declare const MotionStop: ForwardRefComponent<SVGStopElement, SVGMotionProps<SVGStopElement>>;
declare const MotionSvg: ForwardRefComponent<SVGSVGElement, SVGMotionProps<SVGSVGElement>>;
declare const MotionSymbol: ForwardRefComponent<SVGSymbolElement, SVGMotionProps<SVGSymbolElement>>;
declare const MotionText: ForwardRefComponent<SVGTextElement, SVGMotionProps<SVGTextElement>>;
declare const MotionTspan: ForwardRefComponent<SVGTSpanElement, SVGMotionProps<SVGTSpanElement>>;
declare const MotionUse: ForwardRefComponent<SVGUseElement, SVGMotionProps<SVGUseElement>>;
declare const MotionView: ForwardRefComponent<SVGViewElement, SVGMotionProps<SVGViewElement>>;
declare const MotionClipPath: ForwardRefComponent<SVGClipPathElement, SVGMotionProps<SVGClipPathElement>>;
declare const MotionFeBlend: ForwardRefComponent<SVGFEBlendElement, SVGMotionProps<SVGFEBlendElement>>;
declare const MotionFeColorMatrix: ForwardRefComponent<SVGFEColorMatrixElement, SVGMotionProps<SVGFEColorMatrixElement>>;
declare const MotionFeComponentTransfer: ForwardRefComponent<SVGFEComponentTransferElement, SVGMotionProps<SVGFEComponentTransferElement>>;
declare const MotionFeComposite: ForwardRefComponent<SVGFECompositeElement, SVGMotionProps<SVGFECompositeElement>>;
declare const MotionFeConvolveMatrix: ForwardRefComponent<SVGFEConvolveMatrixElement, SVGMotionProps<SVGFEConvolveMatrixElement>>;
declare const MotionFeDiffuseLighting: ForwardRefComponent<SVGFEDiffuseLightingElement, SVGMotionProps<SVGFEDiffuseLightingElement>>;
declare const MotionFeDisplacementMap: ForwardRefComponent<SVGFEDisplacementMapElement, SVGMotionProps<SVGFEDisplacementMapElement>>;
declare const MotionFeDistantLight: ForwardRefComponent<SVGFEDistantLightElement, SVGMotionProps<SVGFEDistantLightElement>>;
declare const MotionFeDropShadow: ForwardRefComponent<SVGFEDropShadowElement, SVGMotionProps<SVGFEDropShadowElement>>;
declare const MotionFeFlood: ForwardRefComponent<SVGFEFloodElement, SVGMotionProps<SVGFEFloodElement>>;
declare const MotionFeFuncA: ForwardRefComponent<SVGFEFuncAElement, SVGMotionProps<SVGFEFuncAElement>>;
declare const MotionFeFuncB: ForwardRefComponent<SVGFEFuncBElement, SVGMotionProps<SVGFEFuncBElement>>;
declare const MotionFeFuncG: ForwardRefComponent<SVGFEFuncGElement, SVGMotionProps<SVGFEFuncGElement>>;
declare const MotionFeFuncR: ForwardRefComponent<SVGFEFuncRElement, SVGMotionProps<SVGFEFuncRElement>>;
declare const MotionFeGaussianBlur: ForwardRefComponent<SVGFEGaussianBlurElement, SVGMotionProps<SVGFEGaussianBlurElement>>;
declare const MotionFeImage: ForwardRefComponent<SVGFEImageElement, SVGMotionProps<SVGFEImageElement>>;
declare const MotionFeMerge: ForwardRefComponent<SVGFEMergeElement, SVGMotionProps<SVGFEMergeElement>>;
declare const MotionFeMergeNode: ForwardRefComponent<SVGFEMergeNodeElement, SVGMotionProps<SVGFEMergeNodeElement>>;
declare const MotionFeMorphology: ForwardRefComponent<SVGFEMorphologyElement, SVGMotionProps<SVGFEMorphologyElement>>;
declare const MotionFeOffset: ForwardRefComponent<SVGFEOffsetElement, SVGMotionProps<SVGFEOffsetElement>>;
declare const MotionFePointLight: ForwardRefComponent<SVGFEPointLightElement, SVGMotionProps<SVGFEPointLightElement>>;
declare const MotionFeSpecularLighting: ForwardRefComponent<SVGFESpecularLightingElement, SVGMotionProps<SVGFESpecularLightingElement>>;
declare const MotionFeSpotLight: ForwardRefComponent<SVGFESpotLightElement, SVGMotionProps<SVGFESpotLightElement>>;
declare const MotionFeTile: ForwardRefComponent<SVGFETileElement, SVGMotionProps<SVGFETileElement>>;
declare const MotionFeTurbulence: ForwardRefComponent<SVGFETurbulenceElement, SVGMotionProps<SVGFETurbulenceElement>>;
declare const MotionForeignObject: ForwardRefComponent<SVGForeignObjectElement, SVGMotionProps<SVGForeignObjectElement>>;
declare const MotionLinearGradient: ForwardRefComponent<SVGLinearGradientElement, SVGMotionProps<SVGLinearGradientElement>>;
declare const MotionRadialGradient: ForwardRefComponent<SVGRadialGradientElement, SVGMotionProps<SVGRadialGradientElement>>;
declare const MotionTextPath: ForwardRefComponent<SVGTextPathElement, SVGMotionProps<SVGTextPathElement>>;

export { MotionA as a, MotionAbbr as abbr, MotionAddress as address, MotionAnimate as animate, MotionArea as area, MotionArticle as article, MotionAside as aside, MotionAudio as audio, MotionB as b, MotionBase as base, MotionBdi as bdi, MotionBdo as bdo, MotionBig as big, MotionBlockquote as blockquote, MotionBody as body, MotionButton as button, MotionCanvas as canvas, MotionCaption as caption, MotionCircle as circle, MotionCite as cite, MotionClipPath as clipPath, MotionCode as code, MotionCol as col, MotionColgroup as colgroup, createMinimalMotionComponent as create, MotionData as data, MotionDatalist as datalist, MotionDd as dd, MotionDefs as defs, MotionDel as del, MotionDesc as desc, MotionDetails as details, MotionDfn as dfn, MotionDialog as dialog, MotionDiv as div, MotionDl as dl, MotionDt as dt, MotionEllipse as ellipse, MotionEm as em, MotionEmbed as embed, MotionFeBlend as feBlend, MotionFeColorMatrix as feColorMatrix, MotionFeComponentTransfer as feComponentTransfer, MotionFeComposite as feComposite, MotionFeConvolveMatrix as feConvolveMatrix, MotionFeDiffuseLighting as feDiffuseLighting, MotionFeDisplacementMap as feDisplacementMap, MotionFeDistantLight as feDistantLight, MotionFeDropShadow as feDropShadow, MotionFeFlood as feFlood, MotionFeFuncA as feFuncA, MotionFeFuncB as feFuncB, MotionFeFuncG as feFuncG, MotionFeFuncR as feFuncR, MotionFeGaussianBlur as feGaussianBlur, MotionFeImage as feImage, MotionFeMerge as feMerge, MotionFeMergeNode as feMergeNode, MotionFeMorphology as feMorphology, MotionFeOffset as feOffset, MotionFePointLight as fePointLight, MotionFeSpecularLighting as feSpecularLighting, MotionFeSpotLight as feSpotLight, MotionFeTile as feTile, MotionFeTurbulence as feTurbulence, MotionFieldset as fieldset, MotionFigcaption as figcaption, MotionFigure as figure, MotionFilter as filter, MotionFooter as footer, MotionForeignObject as foreignObject, MotionForm as form, MotionG as g, MotionH1 as h1, MotionH2 as h2, MotionH3 as h3, MotionH4 as h4, MotionH5 as h5, MotionH6 as h6, MotionHead as head, MotionHeader as header, MotionHgroup as hgroup, MotionHr as hr, MotionHtml as html, MotionI as i, MotionIframe as iframe, MotionImage as image, MotionImg as img, MotionInput as input, MotionIns as ins, MotionKbd as kbd, MotionKeygen as keygen, MotionLabel as label, MotionLegend as legend, MotionLi as li, MotionLine as line, MotionLinearGradient as linearGradient, MotionLink as link, MotionMain as main, MotionMap as map, MotionMark as mark, MotionMarker as marker, MotionMask as mask, MotionMenu as menu, MotionMenuitem as menuitem, MotionMetadata as metadata, MotionMeter as meter, MotionNav as nav, MotionObject as object, MotionOl as ol, MotionOptgroup as optgroup, MotionOption as option, MotionOutput as output, MotionP as p, MotionParam as param, MotionPath as path, MotionPattern as pattern, MotionPicture as picture, MotionPolygon as polygon, MotionPolyline as polyline, MotionPre as pre, MotionProgress as progress, MotionQ as q, MotionRadialGradient as radialGradient, MotionRect as rect, MotionRp as rp, MotionRt as rt, MotionRuby as ruby, MotionS as s, MotionSamp as samp, MotionScript as script, MotionSection as section, MotionSelect as select, MotionSmall as small, MotionSource as source, MotionSpan as span, MotionStop as stop, MotionStrong as strong, MotionStyle as style, MotionSub as sub, MotionSummary as summary, MotionSup as sup, MotionSvg as svg, MotionSymbol as symbol, MotionTable as table, MotionTbody as tbody, MotionTd as td, MotionText as text, MotionTextPath as textPath, MotionTextarea as textarea, MotionTfoot as tfoot, MotionTh as th, MotionThead as thead, MotionTime as time, MotionTitle as title, MotionTr as tr, MotionTrack as track, MotionTspan as tspan, MotionU as u, MotionUl as ul, MotionUse as use, MotionVideo as video, MotionView as view, MotionWbr as wbr, MotionWebview as webview };
