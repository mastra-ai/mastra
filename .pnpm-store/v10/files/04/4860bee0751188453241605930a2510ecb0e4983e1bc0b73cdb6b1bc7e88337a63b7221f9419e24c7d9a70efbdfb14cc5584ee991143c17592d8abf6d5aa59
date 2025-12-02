export type DataURLOptions = Partial<{
    type: string;
    quality: number;
}>;
export interface INode extends Node {
    __sn: serializedNodeWithId;
}
export interface IMirror<TNode> {
    getId(n: TNode | undefined | null): number;
    getNode(id: number): TNode | null;
    getIds(): number[];
    getMeta(n: TNode): serializedNodeWithId | null;
    removeNodeFromMap(n: TNode): void;
    has(id: number): boolean;
    hasNode(node: TNode): boolean;
    add(n: TNode, meta: serializedNodeWithId): void;
    replace(id: number, n: TNode): void;
    reset(): void;
}
export declare class Mirror implements IMirror<Node> {
    private idNodeMap;
    private nodeMetaMap;
    getId(n: Node | undefined | null): number;
    getNode(id: number): Node | null;
    getIds(): number[];
    getMeta(n: Node): serializedNodeWithId | null;
    removeNodeFromMap(n: Node): void;
    has(id: number): boolean;
    hasNode(node: Node): boolean;
    add(n: Node, meta: serializedNodeWithId): void;
    replace(id: number, n: Node): void;
    reset(): void;
}
export type attributes = {
    [key: string]: string | number | true | null;
};
export declare enum NodeType {
    Document = 0,
    DocumentType = 1,
    Element = 2,
    Text = 3,
    CDATA = 4,
    Comment = 5
}
export type documentNode = {
    type: NodeType.Document;
    childNodes: serializedNodeWithId[];
    compatMode?: string;
};
export type documentTypeNode = {
    type: NodeType.DocumentType;
    name: string;
    publicId: string;
    systemId: string;
};
export type elementNode = {
    type: NodeType.Element;
    tagName: string;
    attributes: attributes;
    childNodes: serializedNodeWithId[];
    isSVG?: true;
    needBlock?: boolean;
    isCustom?: true;
};
export type textNode = {
    type: NodeType.Text;
    textContent: string;
    isStyle?: true;
};
export type cdataNode = {
    type: NodeType.CDATA;
    textContent: '';
};
export type commentNode = {
    type: NodeType.Comment;
    textContent: string;
};
export type serializedNode = (documentNode | documentTypeNode | elementNode | textNode | cdataNode | commentNode) & {
    rootId?: number;
    isShadowHost?: boolean;
    isShadow?: boolean;
};
export type serializedNodeWithId = serializedNode & {
    id: number;
};
export type blockClass = string | RegExp;
export type maskTextClass = string | RegExp;
export type IWindow = Window & typeof globalThis;
export type listenerHandler = () => void;
export type KeepIframeSrcFn = (src: string) => boolean;
export type PackFn = (event: eventWithTime) => string;
export declare enum EventType {
    DomContentLoaded = 0,
    Load = 1,
    FullSnapshot = 2,
    IncrementalSnapshot = 3,
    Meta = 4,
    Custom = 5,
    Plugin = 6
}
export declare enum IncrementalSource {
    Mutation = 0,
    MouseMove = 1,
    MouseInteraction = 2,
    Scroll = 3,
    ViewportResize = 4,
    Input = 5,
    TouchMove = 6,
    MediaInteraction = 7,
    StyleSheetRule = 8,
    CanvasMutation = 9,
    Font = 10,
    Log = 11,
    Drag = 12,
    StyleDeclaration = 13,
    Selection = 14,
    AdoptedStyleSheet = 15,
    CustomElement = 16
}
export type domContentLoadedEvent = {
    type: EventType.DomContentLoaded;
    data: unknown;
};
export type loadedEvent = {
    type: EventType.Load;
    data: unknown;
};
export type fullSnapshotEvent = {
    type: EventType.FullSnapshot;
    data: {
        node: serializedNodeWithId;
        initialOffset: {
            top: number;
            left: number;
        };
    };
};
export type metaEvent = {
    type: EventType.Meta;
    data: {
        href: string;
        width: number;
        height: number;
    };
};
export type customEvent<T = unknown> = {
    type: EventType.Custom;
    data: {
        tag: string;
        payload: T;
    };
};
export type pluginEvent<T = unknown> = {
    type: EventType.Plugin;
    data: {
        plugin: string;
        payload: T;
    };
};
export type styleOMValue = {
    [key: string]: styleValueWithPriority | string | false;
};
export type styleValueWithPriority = [string, string];
export type textMutation = {
    id: number;
    value: string | null;
};
export type attributeMutation = {
    id: number;
    attributes: {
        [key: string]: string | styleOMValue | null;
    };
};
export type removedNodeMutation = {
    parentId: number;
    id: number;
    isShadow?: boolean;
};
export type addedNodeMutation = {
    parentId: number;
    previousId?: number | null;
    nextId: number | null;
    node: serializedNodeWithId;
};
export type mutationCallbackParam = {
    texts: textMutation[];
    attributes: attributeMutation[];
    removes: removedNodeMutation[];
    adds: addedNodeMutation[];
    isAttachIframe?: true;
};
export type mutationData = {
    source: IncrementalSource.Mutation;
} & mutationCallbackParam;
export type mousePosition = {
    x: number;
    y: number;
    id: number;
    timeOffset: number;
};
export declare enum MouseInteractions {
    MouseUp = 0,
    MouseDown = 1,
    Click = 2,
    ContextMenu = 3,
    DblClick = 4,
    Focus = 5,
    Blur = 6,
    TouchStart = 7,
    TouchMove_Departed = 8,
    TouchEnd = 9,
    TouchCancel = 10
}
export declare enum PointerTypes {
    Mouse = 0,
    Pen = 1,
    Touch = 2
}
type mouseInteractionParam = {
    type: MouseInteractions;
    id: number;
    x?: number;
    y?: number;
    pointerType?: PointerTypes;
};
export type mouseInteractionData = {
    source: IncrementalSource.MouseInteraction;
} & mouseInteractionParam;
export type mousemoveData = {
    source: IncrementalSource.MouseMove | IncrementalSource.TouchMove | IncrementalSource.Drag;
    positions: mousePosition[];
};
export type scrollPosition = {
    id: number;
    x: number;
    y: number;
};
export type scrollData = {
    source: IncrementalSource.Scroll;
} & scrollPosition;
export type viewportResizeDimension = {
    width: number;
    height: number;
};
export type viewportResizeData = {
    source: IncrementalSource.ViewportResize;
} & viewportResizeDimension;
export type inputValue = {
    text: string;
    isChecked: boolean;
    userTriggered?: boolean;
};
export type inputData = {
    source: IncrementalSource.Input;
    id: number;
} & inputValue;
export declare enum MediaInteractions {
    Play = 0,
    Pause = 1,
    Seeked = 2,
    VolumeChange = 3,
    RateChange = 4
}
export type mediaInteractionParam = {
    type: MediaInteractions;
    id: number;
    currentTime?: number;
    volume?: number;
    muted?: boolean;
    loop?: boolean;
    playbackRate?: number;
};
export type mediaInteractionData = {
    source: IncrementalSource.MediaInteraction;
} & mediaInteractionParam;
export type styleSheetAddRule = {
    rule: string;
    index?: number | number[];
};
export type styleSheetDeleteRule = {
    index: number | number[];
};
export type styleSheetRuleParam = {
    id?: number;
    styleId?: number;
    removes?: styleSheetDeleteRule[];
    adds?: styleSheetAddRule[];
    replace?: string;
    replaceSync?: string;
};
export type styleSheetRuleData = {
    source: IncrementalSource.StyleSheetRule;
} & styleSheetRuleParam;
export declare enum CanvasContext {
    '2D' = 0,
    WebGL = 1,
    WebGL2 = 2
}
export type canvasMutationCommand = {
    property: string;
    args: Array<unknown>;
    setter?: true;
};
export type canvasMutationParam = {
    id: number;
    type: CanvasContext;
    commands: canvasMutationCommand[];
} | ({
    id: number;
    type: CanvasContext;
} & canvasMutationCommand);
export type canvasMutationData = {
    source: IncrementalSource.CanvasMutation;
} & canvasMutationParam;
export type fontParam = {
    family: string;
    fontSource: string;
    buffer: boolean;
    descriptors?: FontFaceDescriptors;
};
export type fontData = {
    source: IncrementalSource.Font;
} & fontParam;
export type SelectionRange = {
    start: number;
    startOffset: number;
    end: number;
    endOffset: number;
};
export type selectionParam = {
    ranges: Array<SelectionRange>;
};
export type selectionData = {
    source: IncrementalSource.Selection;
} & selectionParam;
export type styleDeclarationParam = {
    id?: number;
    styleId?: number;
    index: number[];
    set?: {
        property: string;
        value: string | null;
        priority: string | undefined;
    };
    remove?: {
        property: string;
    };
};
export type styleDeclarationData = {
    source: IncrementalSource.StyleDeclaration;
} & styleDeclarationParam;
export type adoptedStyleSheetParam = {
    id: number;
    styles?: {
        styleId: number;
        rules: styleSheetAddRule[];
    }[];
    styleIds: number[];
};
export type adoptedStyleSheetData = {
    source: IncrementalSource.AdoptedStyleSheet;
} & adoptedStyleSheetParam;
export type customElementParam = {
    define?: {
        name: string;
    };
};
export type customElementData = {
    source: IncrementalSource.CustomElement;
} & customElementParam;
export type incrementalData = mutationData | mousemoveData | mouseInteractionData | scrollData | viewportResizeData | inputData | mediaInteractionData | styleSheetRuleData | canvasMutationData | fontData | selectionData | styleDeclarationData | adoptedStyleSheetData | customElementData;
export type incrementalSnapshotEvent = {
    type: EventType.IncrementalSnapshot;
    data: incrementalData;
};
export type eventWithoutTime = domContentLoadedEvent | loadedEvent | fullSnapshotEvent | incrementalSnapshotEvent | metaEvent | customEvent | pluginEvent;
export type eventWithTime = eventWithoutTime & {
    timestamp: number;
    delay?: number;
};
export type mutationCallBack = (m: mutationCallbackParam) => void;
export type mousemoveCallBack = (p: mousePosition[], source: IncrementalSource.MouseMove | IncrementalSource.TouchMove | IncrementalSource.Drag) => void;
export type mouseInteractionCallBack = (d: mouseInteractionParam) => void;
export type scrollCallback = (p: scrollPosition) => void;
export type viewportResizeCallback = (d: viewportResizeDimension) => void;
export type inputCallback = (v: inputValue & {
    id: number;
}) => void;
export type mediaInteractionCallback = (p: mediaInteractionParam) => void;
export type styleSheetRuleCallback = (s: styleSheetRuleParam) => void;
export type styleDeclarationCallback = (s: styleDeclarationParam) => void;
export type canvasMutationCallback = (p: canvasMutationParam) => void;
export type fontCallback = (p: fontParam) => void;
export type selectionCallback = (p: selectionParam) => void;
export type customElementCallback = (c: customElementParam) => void;
export type adoptedStyleSheetCallback = (a: adoptedStyleSheetParam) => void;
export type hooksParam = {
    mutation?: mutationCallBack;
    mousemove?: mousemoveCallBack;
    mouseInteraction?: mouseInteractionCallBack;
    scroll?: scrollCallback;
    viewportResize?: viewportResizeCallback;
    input?: inputCallback;
    mediaInteaction?: mediaInteractionCallback;
    styleSheetRule?: styleSheetRuleCallback;
    styleDeclaration?: styleDeclarationCallback;
    canvasMutation?: canvasMutationCallback;
    font?: fontCallback;
    selection?: selectionCallback;
    customElement?: customElementCallback;
};
export type SamplingStrategy = Partial<{
    mousemove: boolean | number;
    mousemoveCallback: number;
    mouseInteraction: boolean | Record<string, boolean | undefined>;
    scroll: number;
    media: number;
    input: 'all' | 'last';
    canvas: 'all' | number;
}>;
export interface ICrossOriginIframeMirror {
    getId(iframe: HTMLIFrameElement, remoteId: number, parentToRemoteMap?: Map<number, number>, remoteToParentMap?: Map<number, number>): number;
    getIds(iframe: HTMLIFrameElement, remoteId: number[]): number[];
    getRemoteId(iframe: HTMLIFrameElement, parentId: number, map?: Map<number, number>): number;
    getRemoteIds(iframe: HTMLIFrameElement, parentId: number[]): number[];
    reset(iframe?: HTMLIFrameElement): void;
}
export type RecordPlugin<TOptions = unknown> = {
    name: string;
    observer?: (cb: (...args: Array<unknown>) => void, win: IWindow, options: TOptions) => listenerHandler;
    eventProcessor?: <TExtend>(event: eventWithTime) => eventWithTime & TExtend;
    getMirror?: (mirrors: {
        nodeMirror: Mirror;
        crossOriginIframeMirror: ICrossOriginIframeMirror;
        crossOriginIframeStyleMirror: ICrossOriginIframeMirror;
    }) => void;
    options: TOptions;
};
export {};
