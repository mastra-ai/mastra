import React, { FC, ReactNode, ReactElement, Component } from 'react';
import { Channel, Listener as Listener$1 } from 'storybook/internal/channels';
export { Listener as ChannelListener } from 'storybook/internal/channels';
import { RouterData, NavigateOptions } from 'storybook/internal/router';
import { Addon_Types, Addon_TypesEnum, Addon_Collection, Addon_TypesMapping, Addon_BaseType, Addon_TestProviderType, Addon_PageType, Addon_WrapperType, Addon_Config, API_ProviderData, API_StateMerger, API_Provider, Globals, GlobalTypes, API_PanelPositions, API_Layout, API_LayoutCustomisations, API_UI, API_Notification, API_IframeRenderer, API_ComposedRef, API_SetRefData, API_ComposedRefUpdate, API_Refs, StoryId, API_Settings, API_HashEntry, API_ViewMode, API_LeafEntry, API_PreparedStoryIndex, API_StoryEntry, Args, API_IndexHash, API_DocsEntry, API_FilterFunction, API_LoadedRefData, API_Version, API_Versions, API_UnknownEntries, API_OptionsData, Parameters, ArgTypes, NormalizedProjectAnnotations, ProjectAnnotations, ComposedStoryFn } from 'storybook/internal/types';
export { Addon_Type as Addon, API_ComponentEntry as ComponentEntry, API_ComposedRef as ComposedRef, API_DocsEntry as DocsEntry, API_GroupEntry as GroupEntry, API_HashEntry as HashEntry, API_IndexHash as IndexHash, API_LeafEntry as LeafEntry, API_Refs as Refs, API_RootEntry as RootEntry, API_IndexHash as StoriesHash, API_StoryEntry as StoryEntry } from 'storybook/internal/types';
import { ThemeVars } from 'storybook/theming';
import { toId, StoryId as StoryId$1 } from 'storybook/internal/csf';
import { WhatsNewData } from 'storybook/internal/core-events';

declare function mockChannel(): Channel;

declare class AddonStore {
    constructor();
    private loaders;
    private elements;
    private config;
    private channel;
    private promise;
    private resolve;
    getChannel: () => Channel;
    ready: () => Promise<Channel>;
    hasChannel: () => boolean;
    setChannel: (channel: Channel) => void;
    getElements<T extends Addon_Types | Addon_TypesEnum.experimental_PAGE | Addon_TypesEnum.experimental_TEST_PROVIDER>(type: T): Addon_Collection<Addon_TypesMapping[T]> | any;
    /**
     * Adds an addon to the addon store.
     *
     * @param {string} id - The id of the addon.
     * @param {Addon_Type} addon - The addon to add.
     * @returns {void}
     */
    add(id: string, addon: Addon_BaseType | Omit<Addon_TestProviderType, 'id'> | Omit<Addon_PageType, 'id'> | Omit<Addon_WrapperType, 'id'>): void;
    setConfig: (value: Addon_Config) => void;
    getConfig: () => Addon_Config;
    /**
     * Registers an addon loader function.
     *
     * @param {string} id - The id of the addon loader.
     * @param {(api: API) => void} callback - The function that will be called to register the addon.
     * @returns {void}
     */
    register: (id: string, callback: (api: API) => void) => void;
    loadAddons: (api: any) => void;
    experimental_getRegisteredAddons(): string[];
}
declare const addons: AddonStore;

type GetState = () => State;
type SetState = (a: any, b: any) => any;
interface Upstream {
    getState: GetState;
    setState: SetState;
}
type Patch = Partial<State>;
type InputFnPatch = (s: State) => Patch;
type InputPatch = Patch | InputFnPatch;
interface Options {
    persistence: 'none' | 'session' | string;
}
type CallBack = (s: State) => void;
declare class Store {
    upstreamGetState: GetState;
    upstreamSetState: SetState;
    constructor({ setState, getState }: Upstream);
    getInitialState(base: State): any;
    getState(): State;
    setState(inputPatch: InputPatch, options?: Options): Promise<State>;
    setState(inputPatch: InputPatch, callback?: CallBack, options?: Options): Promise<State>;
}

type ModuleFn<APIType = unknown, StateType = unknown> = (m: ModuleArgs, options?: any) => {
    init?: () => void | Promise<void>;
    api: APIType;
    state: StateType;
};
type ModuleArgs = RouterData & API_ProviderData<API> & {
    mode?: 'production' | 'development';
    state: State;
    fullAPI: API;
    store: Store;
};

interface SubAPI$c {
    /**
     * Returns a collection of elements of a specific type.
     *
     * @template T - The type of the elements in the collection.
     * @param {Addon_Types | Addon_TypesEnum.experimental_PAGE} type - The type of the elements to
     *   retrieve.
     * @returns {Addon_Collection<T>} - A collection of elements of the specified type.
     * @protected This is used internally in storybook's manager.
     */
    getElements: <T extends Addon_Types | Addon_TypesEnum.experimental_PAGE | Addon_TypesEnum.experimental_TEST_PROVIDER>(type: T) => Addon_Collection<Addon_TypesMapping[T]>;
    /**
     * Returns the id of the currently selected panel.
     *
     * @returns {string} - The ID of the currently selected panel.
     */
    getSelectedPanel: () => string;
    /**
     * Sets the currently selected panel via it's ID.
     *
     * @param {string} panelName - The ID of the panel to select.
     * @returns {void}
     */
    setSelectedPanel: (panelName: string) => void;
    /**
     * Sets the state of an addon with the given ID.
     *
     * @deprecated This API might get dropped, if you are using this, please file an issue.
     * @template S - The type of the addon state.
     * @param {string} addonId - The ID of the addon to set the state for.
     * @param {S | API_StateMerger<S>} newStateOrMerger - The new state to set, or a function which
     *   receives the current state and returns the new state.
     * @param {Options} [options] - Optional options for the state update.
     * @returns {Promise<S>} - A promise that resolves with the new state after it has been set.
     */
    setAddonState<S>(addonId: string, newStateOrMerger: S | API_StateMerger<S>, options?: Options): Promise<S>;
    /**
     * Returns the state of an addon with the given ID.
     *
     * @deprecated This API might get dropped, if you are using this, please file an issue.
     * @template S - The type of the addon state.
     * @param {string} addonId - The ID of the addon to get the state for.
     * @returns {S} - The state of the addon with the given ID.
     */
    getAddonState<S>(addonId: string): S;
}

interface SubAPI$b {
    /**
     * Returns the channel object.
     *
     * @protected Please do not use, it's for internal use only.
     */
    getChannel: () => API_Provider<API>['channel'];
    /**
     * Adds a listener to the channel for the given event type. Returns a function that can be called
     * to remove the listener.
     *
     * @param type - The event type to listen for. If using a core event, import it from
     *   `storybook/internal/core-events`.
     * @param handler - The callback function to be called when the event is emitted.
     * @returns A function that can be called to remove the listener.
     */
    on: (type: string, handler: Listener$1) => () => void;
    /**
     * Removes a listener from the channel for the given event type.
     *
     * @param type - The event type to remove the listener from. If using a core event, import it from
     *   `storybook/internal/core-events`.
     * @param handler - The callback function to be removed.
     */
    off: (type: string, handler: Listener$1) => void;
    /**
     * Emits an event on the channel for the given event type.
     *
     * @param type - The event type to emit. If using a core event, import it from
     *   `storybook/internal/core-events`.
     * @param args - The arguments to pass to the event listener.
     */
    emit: (type: string, ...args: any[]) => void;
    /**
     * Adds a one-time listener to the channel for the given event type.
     *
     * @param type - The event type to listen for. If using a core event, import it from
     *   `storybook/internal/core-events`.
     * @param handler - The callback function to be called when the event is emitted.
     */
    once: (type: string, handler: Listener$1) => void;
}

interface SubState$9 {
    globals?: Globals;
    userGlobals?: Globals;
    storyGlobals?: Globals;
    globalTypes?: GlobalTypes;
}
interface SubAPI$a {
    /**
     * Returns the current globals, which is the user globals overlaid with the story globals
     *
     * @returns {Globals} The current globals.
     */
    getGlobals: () => Globals;
    /**
     * Returns the current globals, as set by the user (a story may have override values)
     *
     * @returns {Globals} The current user globals.
     */
    getUserGlobals: () => Globals /**
     * /** Returns the current globals, as set by the story
     *
     * @returns {Globals} The current story globals.
     */;
    getStoryGlobals: () => Globals /**
     * Returns the globalTypes, as defined at the project level.
     *
     * @returns {GlobalTypes} The globalTypes.
     */;
    getGlobalTypes: () => GlobalTypes;
    /**
     * Updates the current globals with the provided new globals.
     *
     * @param {Globals} newGlobals - The new globals to update with.
     * @returns {void}
     */
    updateGlobals: (newGlobals: Globals) => void;
}

interface SubState$8 {
    layout: API_Layout;
    layoutCustomisations: API_LayoutCustomisations;
    ui: API_UI;
    selectedPanel: string | undefined;
    theme: ThemeVars;
}
interface SubAPI$9 {
    /**
     * Toggles the fullscreen mode of the Storybook UI.
     *
     * @param toggled - Optional boolean value to set the fullscreen mode to. If not provided, it will
     *   toggle the current state.
     */
    toggleFullscreen: (toggled?: boolean) => void;
    /**
     * Toggles the visibility of the panel in the Storybook UI.
     *
     * @param toggled - Optional boolean value to set the panel visibility to. If not provided, it
     *   will toggle the current state.
     */
    togglePanel: (toggled?: boolean) => void;
    /**
     * Toggles the position of the panel in the Storybook UI.
     *
     * @param position - Optional string value to set the panel position to. If not provided, it will
     *   toggle between 'bottom' and 'right'.
     */
    togglePanelPosition: (position?: API_PanelPositions) => void;
    /**
     * Toggles the visibility of the navigation bar in the Storybook UI.
     *
     * @param toggled - Optional boolean value to set the navigation bar visibility to. If not
     *   provided, it will toggle the current state.
     */
    toggleNav: (toggled?: boolean) => void;
    /**
     * Toggles the visibility of the toolbar in the Storybook UI.
     *
     * @param toggled - Optional boolean value to set the toolbar visibility to. If not provided, it
     *   will toggle the current state.
     */
    toggleToolbar: (toggled?: boolean) => void;
    /**
     * Sets the options for the Storybook UI.
     *
     * @param options - An object containing the options to set.
     */
    setOptions: (options: any) => void;
    /** Sets the sizes of the resizable elements in the layout. */
    setSizes: (options: Partial<Pick<API_Layout, 'navSize' | 'bottomPanelHeight' | 'rightPanelWidth'>>) => void;
    /** GetIsFullscreen - Returns the current fullscreen mode of the Storybook UI. */
    getIsFullscreen: () => boolean;
    /** GetIsPanelShown - Returns the current visibility of the panel in the Storybook UI. */
    getIsPanelShown: () => boolean;
    /** GetIsNavShown - Returns the current visibility of the navigation bar in the Storybook UI. */
    getIsNavShown: () => boolean;
    /**
     * GetShowToolbarWithCustomisations - Returns the current visibility of the toolbar, taking into
     * account customisations requested by the end user via a layoutCustomisations function.
     */
    getShowToolbarWithCustomisations: (showToolbar: boolean) => boolean;
    /**
     * GetNavSizeWithCustomisations - Returns the size to apply to the sidebar/nav, taking into
     * account customisations requested by the end user via a layoutCustomisations function.
     */
    getNavSizeWithCustomisations: (navSize: number) => number;
}

interface SubState$7 {
    notifications: API_Notification[];
}
/** The API for managing notifications. */
interface SubAPI$8 {
    /**
     * Adds a new notification to the list of notifications. If a notification with the same ID
     * already exists, it will be replaced.
     *
     * @param notification - The notification to add.
     */
    addNotification: (notification: API_Notification) => void;
    /**
     * Removes a notification from the list of notifications and calls the onClear callback.
     *
     * @param id - The ID of the notification to remove.
     */
    clearNotification: (id: string) => void;
}

interface SubAPI$7 {
    renderPreview?: API_IframeRenderer;
}

interface SubState$6 {
    refs: API_Refs;
}
interface SubAPI$6 {
    /**
     * Finds a composed ref by its source.
     *
     * @param {string} source - The source/URL of the composed ref.
     * @returns {API_ComposedRef} - The composed ref object.
     */
    findRef: (source: string) => API_ComposedRef;
    /**
     * Sets a composed ref by its ID and data.
     *
     * @param {string} id - The ID of the composed ref.
     * @param {API_SetRefData} data - The data to set for the composed ref.
     * @param {boolean} [ready] - Whether the composed ref is ready.
     */
    setRef: (id: string, data: API_SetRefData, ready?: boolean) => void;
    /**
     * Updates a composed ref by its ID and update object.
     *
     * @param {string} id - The ID of the composed ref.
     * @param {API_ComposedRefUpdate} ref - The update object for the composed ref.
     */
    updateRef: (id: string, ref: API_ComposedRefUpdate) => Promise<void>;
    /**
     * Gets all composed refs.
     *
     * @returns {API_Refs} - The composed refs object.
     */
    getRefs: () => API_Refs;
    /**
     * Checks if a composed ref is valid.
     *
     * @param {API_SetRefData} ref - The composed ref to check.
     * @returns {Promise<void>} - A promise that resolves when the check is complete.
     */
    checkRef: (ref: API_SetRefData) => Promise<void>;
    /**
     * Changes the version of a composed ref by its ID and URL.
     *
     * @param {string} id - The ID of the composed ref.
     * @param {string} url - The new URL for the composed ref.
     */
    changeRefVersion: (id: string, url: string) => Promise<void>;
    /**
     * Changes the state of a composed ref by its ID and previewInitialized flag.
     *
     * @param {string} id - The ID of the composed ref.
     * @param {boolean} previewInitialized - The new previewInitialized flag for the composed ref.
     */
    changeRefState: (id: string, previewInitialized: boolean) => void;
}

interface SubAPI$5 {
    storeSelection: () => void;
    retrieveSelection: () => StoryId;
    /**
     * Changes the active settings tab.
     *
     * @example
     *
     * ```ts
     * changeSettingsTab(`about`);
     * ```
     *
     * @param path - The path of the settings page to navigate to. The path NOT should include the
     *   `/settings` prefix.
     */
    changeSettingsTab: (path: string) => void;
    /** Closes the settings screen and returns to the last tracked story or the first story. */
    closeSettings: () => void;
    /**
     * Checks if the settings screen is currently active.
     *
     * @returns A boolean indicating whether the settings screen is active.
     */
    isSettingsScreenActive: () => boolean;
}
interface SubState$5 {
    settings: API_Settings;
}

declare const isMacLike: () => boolean;
declare const controlOrMetaSymbol: () => "⌘" | "ctrl";
declare const controlOrMetaKey: () => "meta" | "control";
declare const optionOrAltSymbol: () => "⌥" | "alt";
declare const isShortcutTaken: (arr1: string[], arr2: string[]) => boolean;
type KeyboardEventLike = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key' | 'code' | 'keyCode' | 'preventDefault'>;
declare const eventToShortcut: (e: KeyboardEventLike) => (string | string[])[] | null;
declare const shortcutMatchesShortcut: (inputShortcut: (string | string[])[], shortcut: API_KeyCollection) => boolean;
declare const eventMatchesShortcut: (e: KeyboardEventLike, shortcut: API_KeyCollection) => boolean;
declare const keyToSymbol: (key: string) => string;
declare const shortcutToHumanString: (shortcut: API_KeyCollection) => string;

interface SubState$4 {
    shortcuts: API_Shortcuts;
}
interface SubAPI$4 {
    /** Returns the current shortcuts. */
    getShortcutKeys(): API_Shortcuts;
    /** Returns the default shortcuts. */
    getDefaultShortcuts(): API_Shortcuts | API_AddonShortcutDefaults;
    /** Returns the shortcuts for addons. */
    getAddonsShortcuts(): API_AddonShortcuts;
    /** Returns the labels for addon shortcuts. */
    getAddonsShortcutLabels(): API_AddonShortcutLabels;
    /** Returns the default shortcuts for addons. */
    getAddonsShortcutDefaults(): API_AddonShortcutDefaults;
    /**
     * Sets the shortcuts to the given value.
     *
     * @param shortcuts The new shortcuts to set.
     * @returns A promise that resolves to the new shortcuts.
     */
    setShortcuts(shortcuts: API_Shortcuts): Promise<API_Shortcuts>;
    /**
     * Sets the shortcut for the given action to the given value.
     *
     * @param action The action to set the shortcut for.
     * @param value The new shortcut to set.
     * @returns A promise that resolves to the new shortcut.
     */
    setShortcut(action: API_Action, value: API_KeyCollection): Promise<API_KeyCollection>;
    /**
     * Sets the shortcut for the given addon to the given value.
     *
     * @param addon The addon to set the shortcut for.
     * @param shortcut The new shortcut to set.
     * @returns A promise that resolves to the new addon shortcut.
     */
    setAddonShortcut(addon: string, shortcut: API_AddonShortcut): Promise<API_AddonShortcut>;
    /**
     * Restores all default shortcuts.
     *
     * @returns A promise that resolves to the new shortcuts.
     */
    restoreAllDefaultShortcuts(): Promise<API_Shortcuts>;
    /**
     * Restores the default shortcut for the given action.
     *
     * @param action The action to restore the default shortcut for.
     * @returns A promise that resolves to the new shortcut.
     */
    restoreDefaultShortcut(action: API_Action): Promise<API_KeyCollection>;
    /**
     * Handles a keydown event.
     *
     * @param event The event to handle.
     */
    handleKeydownEvent(event: KeyboardEventLike): void;
    /**
     * Handles a shortcut feature.
     *
     * @param feature The feature to handle.
     * @param event The event to handle.
     */
    handleShortcutFeature(feature: API_Action, event: KeyboardEventLike): void;
}
type API_KeyCollection = string[];
interface API_Shortcuts {
    fullScreen: API_KeyCollection;
    togglePanel: API_KeyCollection;
    panelPosition: API_KeyCollection;
    toggleNav: API_KeyCollection;
    toolbar: API_KeyCollection;
    search: API_KeyCollection;
    focusNav: API_KeyCollection;
    focusIframe: API_KeyCollection;
    focusPanel: API_KeyCollection;
    prevComponent: API_KeyCollection;
    nextComponent: API_KeyCollection;
    prevStory: API_KeyCollection;
    nextStory: API_KeyCollection;
    shortcutsPage: API_KeyCollection;
    aboutPage: API_KeyCollection;
    escape: API_KeyCollection;
    collapseAll: API_KeyCollection;
    expandAll: API_KeyCollection;
    remount: API_KeyCollection;
}
type API_Action = keyof API_Shortcuts;
interface API_AddonShortcut {
    label: string;
    defaultShortcut: API_KeyCollection;
    actionName: string;
    showInMenu?: boolean;
    action: (...args: any[]) => any;
}
type API_AddonShortcuts = Record<string, API_AddonShortcut>;
type API_AddonShortcutLabels = Record<string, string>;
type API_AddonShortcutDefaults = Record<string, API_KeyCollection>;

type Direction = -1 | 1;
type ParameterName = string;
type StoryUpdate = Partial<Pick<API_StoryEntry, 'prepared' | 'parameters' | 'initialArgs' | 'argTypes' | 'args'>>;
type DocsUpdate = Partial<Pick<API_DocsEntry, 'prepared' | 'parameters'>>;
interface SubState$3 extends API_LoadedRefData {
    storyId: StoryId;
    internal_index?: API_PreparedStoryIndex;
    viewMode: API_ViewMode;
    filters: Record<string, API_FilterFunction>;
}
interface SubAPI$3 {
    /**
     * The `storyId` method is a reference to the `toId` function from `@storybook/csf`, which is used
     * to generate a unique ID for a story. This ID is used to identify a specific story in the
     * Storybook index.
     *
     * @type {typeof toId}
     */
    storyId: typeof toId;
    /**
     * Resolves a story, docs, component or group ID to its corresponding hash entry in the index.
     *
     * @param {StoryId} storyId - The ID of the story to resolve.
     * @param {string} [refsId] - The ID of the refs to use for resolving the story.
     * @returns {API_HashEntry} - The hash entry corresponding to the given story ID.
     */
    resolveStory: (storyId: StoryId, refsId?: string) => API_HashEntry | undefined;
    /**
     * Selects the first story to display in the Storybook UI.
     *
     * @returns {void}
     */
    selectFirstStory: () => void;
    /**
     * Selects a story to display in the Storybook UI.
     *
     * @param {string} [kindOrId] - The kind or ID of the story to select.
     * @param {StoryId} [story] - The ID of the story to select.
     * @param {Object} [obj] - An optional object containing additional options.
     * @param {string} [obj.ref] - The ref ID of the story to select.
     * @param {API_ViewMode} [obj.viewMode] - The view mode to display the story in.
     * @returns {void}
     */
    selectStory: (kindOrId?: string, story?: StoryId, obj?: {
        ref?: string;
        viewMode?: API_ViewMode;
    }) => void;
    /**
     * Returns the current story's data, including its ID, kind, name, and parameters.
     *
     * @returns {API_LeafEntry} The current story's data.
     */
    getCurrentStoryData: () => API_LeafEntry;
    /**
     * Sets the prepared story index to the given value.
     *
     * @param {API_PreparedStoryIndex} index - The prepared story index to set.
     * @returns {Promise<void>} A promise that resolves when the prepared story index has been set.
     */
    setIndex: (index: API_PreparedStoryIndex) => Promise<void>;
    /**
     * Jumps to the next or previous component in the index.
     *
     * @param {Direction} direction - The direction to jump. Use -1 to jump to the previous component,
     *   and 1 to jump to the next component.
     * @returns {void}
     */
    jumpToComponent: (direction: Direction) => void;
    /**
     * Jumps to the next or previous story in the story index.
     *
     * @param {Direction} direction - The direction to jump. Use -1 to jump to the previous story, and
     *   1 to jump to the next story.
     * @returns {void}
     */
    jumpToStory: (direction: Direction) => void;
    /**
     * Returns the data for the given story ID and optional ref ID.
     *
     * @param {StoryId} storyId - The ID of the story to retrieve data for.
     * @param {string} [refId] - The ID of the ref to retrieve data for. If not provided, retrieves
     *   data for the default ref.
     * @returns {API_LeafEntry} The data for the given story ID and optional ref ID.
     */
    getData: (storyId: StoryId, refId?: string) => API_LeafEntry;
    /**
     * Returns a boolean indicating whether the given story ID and optional ref ID have been prepared.
     *
     * @param {StoryId} storyId - The ID of the story to check.
     * @param {string} [refId] - The ID of the ref to check. If not provided, checks all refs for the
     *   given story ID.
     * @returns {boolean} A boolean indicating whether the given story ID and optional ref ID have
     *   been prepared.
     */
    isPrepared: (storyId: StoryId, refId?: string) => boolean;
    /**
     * Returns the parameters for the given story ID and optional ref ID.
     *
     * @param {StoryId | { storyId: StoryId; refId: string }} storyId - The ID of the story to
     *   retrieve parameters for, or an object containing the story ID and ref ID.
     * @param {ParameterName} [parameterName] - The name of the parameter to retrieve. If not
     *   provided, returns all parameters.
     * @returns {API_StoryEntry['parameters'] | any} The parameters for the given story ID and
     *   optional ref ID.
     */
    getParameters: (storyId: StoryId | {
        storyId: StoryId;
        refId: string;
    }, parameterName?: ParameterName) => API_StoryEntry['parameters'] | any;
    /**
     * Returns the current value of the specified parameter for the currently selected story.
     *
     * @template S - The type of the parameter value.
     * @param {ParameterName} [parameterName] - The name of the parameter to retrieve. If not
     *   provided, returns all parameters.
     * @returns {S} The value of the specified parameter for the currently selected story.
     */
    getCurrentParameter<S>(parameterName?: ParameterName): S;
    /**
     * Updates the arguments for the given story with the provided new arguments.
     *
     * @param {API_StoryEntry} story - The story to update the arguments for.
     * @param {Args} newArgs - The new arguments to set for the story.
     * @returns {void}
     */
    updateStoryArgs(story: API_StoryEntry, newArgs: Args): void;
    /**
     * Resets the arguments for the given story to their initial values.
     *
     * @param {API_StoryEntry} story - The story to reset the arguments for.
     * @param {string[]} [argNames] - An optional array of argument names to reset. If not provided,
     *   all arguments will be reset.
     * @returns {void}
     */
    resetStoryArgs: (story: API_StoryEntry, argNames?: string[]) => void;
    /**
     * Finds the leaf entry for the given story ID in the given story index.
     *
     * @param {API_IndexHash} index - The story index to search for the leaf entry in.
     * @param {StoryId} storyId - The ID of the story to find the leaf entry for.
     * @returns {API_LeafEntry} The leaf entry for the given story ID, or null if no leaf entry was
     *   found.
     */
    findLeafEntry(index: API_IndexHash, storyId: StoryId): API_LeafEntry;
    /**
     * Finds the leaf story ID for the given component or group ID in the given index.
     *
     * @param {API_IndexHash} index - The story index to search for the leaf story ID in.
     * @param {StoryId} storyId - The ID of the story to find the leaf story ID for.
     * @returns {StoryId} The ID of the leaf story, or null if no leaf story was found.
     */
    findLeafStoryId(index: API_IndexHash, storyId: StoryId): StoryId;
    /**
     * Finds all the leaf story IDs for the given entry ID in the given index.
     *
     * @param {StoryId} entryId - The ID of the entry to find the leaf story IDs for.
     * @returns {StoryId[]} The IDs of all the leaf stories, or an empty array if no leaf stories were
     *   found.
     */
    findAllLeafStoryIds(entryId: string): StoryId[];
    /**
     * Finds the ID of the sibling story in the given direction for the given story ID in the given
     * story index.
     *
     * @param {StoryId} storyId - The ID of the story to find the sibling of.
     * @param {API_IndexHash} index - The story index to search for the sibling in.
     * @param {Direction} direction - The direction to search for the sibling in.
     * @param {boolean} toSiblingGroup - When true, skips over leafs within the same group.
     * @returns {StoryId} The ID of the sibling story, or null if no sibling was found.
     */
    findSiblingStoryId(storyId: StoryId, index: API_IndexHash, direction: Direction, toSiblingGroup: boolean): StoryId;
    /**
     * Fetches the story index from the server.
     *
     * @returns {Promise<void>} A promise that resolves when the index has been fetched.
     */
    fetchIndex: () => Promise<void>;
    /**
     * Updates the story with the given ID with the provided update object.
     *
     * @param {StoryId} storyId - The ID of the story to update.
     * @param {StoryUpdate} update - An object containing the updated story information.
     * @param {API_ComposedRef} [ref] - The composed ref of the story to update.
     * @returns {Promise<void>} A promise that resolves when the story has been updated.
     */
    updateStory: (storyId: StoryId, update: StoryUpdate, ref?: API_ComposedRef) => Promise<void>;
    /**
     * Updates the documentation for the given story ID with the given update object.
     *
     * @param {StoryId} storyId - The ID of the story to update.
     * @param {DocsUpdate} update - An object containing the updated documentation information.
     * @param {API_ComposedRef} [ref] - The composed ref of the story to update.
     * @returns {Promise<void>} A promise that resolves when the documentation has been updated.
     */
    updateDocs: (storyId: StoryId, update: DocsUpdate, ref?: API_ComposedRef) => Promise<void>;
    /**
     * Sets the preview as initialized.
     *
     * @param {ComposedRef} [ref] - The composed ref of the story to set as initialized.
     * @returns {Promise<void>} A promise that resolves when the preview has been set as initialized.
     */
    setPreviewInitialized: (ref?: API_ComposedRef) => Promise<void>;
    /**
     * Updates the filtering of the index.
     *
     * @param {string} addonId - The ID of the addon to update.
     * @param {API_FilterFunction} filterFunction - A function that returns a boolean based on the
     *   story, index and status.
     * @returns {Promise<void>} A promise that resolves when the state has been updated.
     */
    experimental_setFilter: (addonId: string, filterFunction: API_FilterFunction) => Promise<void>;
}

interface SubState$2 {
    customQueryParams: QueryParams;
}
interface QueryParams {
    [key: string]: string | undefined;
}
/** SubAPI for managing URL navigation and state. */
interface SubAPI$2 {
    /**
     * Navigate to a new URL.
     *
     * @param {string} url - The URL to navigate to.
     * @param {NavigateOptions} options - Options for the navigation.
     * @returns {void}
     */
    navigateUrl: (url: string, options: NavigateOptions) => void;
    /**
     * Get the value of a query parameter from the current URL.
     *
     * @param {string} key - The key of the query parameter to get.
     * @returns {string | undefined} The value of the query parameter, or undefined if it does not
     *   exist.
     */
    getQueryParam: (key: string) => string | undefined;
    /**
     * Returns an object containing the current state of the URL.
     *
     * @returns {{
     *   queryParams: QueryParams;
     *   path: string;
     *   viewMode?: string;
     *   storyId?: string;
     *   url: string;
     * }}
     *   An object containing the current state of the URL.
     */
    getUrlState: () => {
        queryParams: QueryParams;
        path: string;
        hash: string;
        viewMode?: string;
        storyId?: string;
        url: string;
    };
    /**
     * Set the query parameters for the current URL.
     *
     * @param {QueryParams} input - An object containing the query parameters to set.
     * @returns {void}
     */
    setQueryParams: (input: QueryParams) => void;
    /**
     * Set the query parameters for the current URL & navigates.
     *
     * @param {QueryParams} input - An object containing the query parameters to set.
     * @param {NavigateOptions} options - Options for the navigation.
     * @returns {void}
     */
    applyQueryParams: (input: QueryParams, options?: NavigateOptions) => void;
}

interface SubState$1 {
    versions: API_Versions & API_UnknownEntries;
    lastVersionCheck: number;
    dismissedVersionNotification: undefined | string;
}
interface SubAPI$1 {
    /**
     * Returns the current version of the Storybook Manager.
     *
     * @returns {API_Version} The current version of the Storybook Manager.
     */
    getCurrentVersion: () => API_Version;
    /**
     * Returns the latest version of the Storybook Manager.
     *
     * @returns {API_Version} The latest version of the Storybook Manager.
     */
    getLatestVersion: () => API_Version;
    /**
     * Returns the URL of the Storybook documentation for the current version.
     *
     * @returns {string} The URL of the Storybook Manager documentation.
     */
    getDocsUrl: (options: {
        subpath?: string;
        versioned?: boolean;
        renderer?: boolean;
    }) => string;
    /**
     * Checks if an update is available for the Storybook Manager.
     *
     * @returns {boolean} True if an update is available, false otherwise.
     */
    versionUpdateAvailable: () => boolean;
}

type SubState = {
    whatsNewData?: WhatsNewData;
};
type SubAPI = {
    isWhatsNewUnread(): boolean;
    whatsNewHasBeenRead(): void;
    toggleWhatsNewNotifications(): void;
};

declare class RequestResponseError<Payload extends Record<string, any> | void> extends Error {
    payload: Payload | undefined;
    constructor(message: string, payload?: Payload);
}
declare const experimental_requestResponse: <RequestPayload, ResponsePayload = void, CreateNewStoryErrorPayload extends Record<string, any> | void = void>(channel: Channel, requestEvent: string, responseEvent: string, payload: RequestPayload, timeout?: number) => Promise<ResponsePayload>;

declare const _default: <TObj = any>(a: TObj, ...b: Partial<TObj>[]) => TObj;

declare const ActiveTabs: {
    SIDEBAR: "sidebar";
    CANVAS: "canvas";
    ADDONS: "addons";
};

declare const ManagerContext: React.Context<{
    api: API;
    state: State;
}>;
type State = SubState$8 & SubState$3 & SubState$6 & SubState$7 & SubState$1 & SubState$2 & SubState$4 & SubState$5 & SubState$9 & SubState & RouterData & API_OptionsData & Other;
type API = SubAPI$c & SubAPI$b & SubAPI$7 & SubAPI$3 & SubAPI$6 & SubAPI$a & SubAPI$9 & SubAPI$8 & SubAPI$4 & SubAPI$5 & SubAPI$1 & SubAPI$2 & SubAPI & Other;
interface Other {
    [key: string]: any;
}
interface Combo {
    api: API;
    state: State;
}
type ManagerProviderProps = RouterData & API_ProviderData<API> & {
    children: ReactNode | FC<Combo>;
};
declare const combineParameters: (...parameterSets: Parameters[]) => {};
declare class ManagerProvider extends Component<ManagerProviderProps, State> {
    api: API;
    modules: ReturnType<ModuleFn>[];
    static displayName: string;
    constructor(props: ManagerProviderProps);
    static getDerivedStateFromProps(props: ManagerProviderProps, state: State): State;
    shouldComponentUpdate(nextProps: ManagerProviderProps, nextState: State): boolean;
    initModules: () => void;
    render(): React.JSX.Element;
}
interface ManagerConsumerProps<P = unknown> {
    filter?: (combo: Combo) => P;
    children: FC<P> | ReactNode;
}
declare function ManagerConsumer<P = Combo>({ filter, children, }: ManagerConsumerProps<P>): ReactElement;
declare function useStorybookState(): State;
declare function useStorybookApi(): API;

interface API_EventMap {
    [eventId: string]: Listener$1;
}
declare const useChannel: (eventMap: API_EventMap, deps?: any[]) => (type: string, ...args: any[]) => void;
declare function useStoryPrepared(storyId?: StoryId): boolean;
declare function useParameter<S>(parameterKey: string, defaultValue?: S): S;
declare function useSharedState<S>(stateId: string, defaultState?: S): [S, (newStateOrMerger: S | API_StateMerger<S>, options?: Options) => void];
declare function useAddonState<S>(addonId: string, defaultState?: S): [S, (newStateOrMerger: S | API_StateMerger<S>, options?: Options) => void];
declare function useArgs(): [Args, (newArgs: Args) => void, (argNames?: string[]) => void, Args];
declare function useGlobals(): [
    globals: Globals,
    updateGlobals: (newGlobals: Globals) => void,
    storyGlobals: Globals,
    userGlobals: Globals
];
declare function useGlobalTypes(): ArgTypes;
declare function useArgTypes(): ArgTypes;

declare const typesX: typeof Addon_TypesEnum;

type EnvironmentType = (typeof UniversalStore.Environment)[keyof typeof UniversalStore.Environment];
type StatusType = (typeof UniversalStore.Status)[keyof typeof UniversalStore.Status];
type StateUpdater<TState> = (prevState: TState) => TState;
type Actor = {
    id: string;
    type: (typeof UniversalStore.ActorType)[keyof typeof UniversalStore.ActorType];
    environment: EnvironmentType;
};
type EventInfo = {
    actor: Actor;
    forwardingActor?: Actor;
};
type Listener<TEvent> = (event: TEvent, eventInfo: EventInfo) => void;
type BaseEvent = {
    type: string;
    payload?: any;
};
interface SetStateEvent<TState> extends BaseEvent {
    type: typeof UniversalStore.InternalEventType.SET_STATE;
    payload: {
        state: TState;
        previousState: TState;
    };
}
interface ExistingStateRequestEvent extends BaseEvent {
    type: typeof UniversalStore.InternalEventType.EXISTING_STATE_REQUEST;
    payload: never;
}
interface ExistingStateResponseEvent<TState> extends BaseEvent {
    type: typeof UniversalStore.InternalEventType.EXISTING_STATE_RESPONSE;
    payload: TState;
}
interface LeaderCreatedEvent extends BaseEvent {
    type: typeof UniversalStore.InternalEventType.LEADER_CREATED;
    payload: never;
}
interface FollowerCreatedEvent extends BaseEvent {
    type: typeof UniversalStore.InternalEventType.FOLLOWER_CREATED;
    payload: never;
}
type InternalEvent<TState> = SetStateEvent<TState> | ExistingStateRequestEvent | ExistingStateResponseEvent<TState> | FollowerCreatedEvent | LeaderCreatedEvent;
type Event<TState, TEvent extends BaseEvent> = TEvent | InternalEvent<TState>;
type ChannelLike = Pick<Channel, 'on' | 'off' | 'emit'>;
type StoreOptions<TState> = {
    id: string;
    leader?: boolean;
    initialState?: TState;
    debug?: boolean;
};
type EnvironmentOverrides = {
    channel: ChannelLike;
    environment: EnvironmentType;
};

/**
 * A universal store implementation that synchronizes state across different environments using a
 * channel-based communication.
 *
 * The store follows a leader-follower pattern where:
 *
 * - Leader: The main store instance that owns and manages the state
 * - Follower: Store instances that mirror the leader's state
 *
 * Features:
 *
 * - State synchronization across environments
 * - Event-based communication
 * - Type-safe state and custom events
 * - Subscription system for state changes and custom events
 *
 * @remarks
 * - The store must be created using the static `create()` method, not the constructor
 * - Follower stores will automatically sync with their leader's state. If they have initial state, it
 *   will be replaced immediately when it has synced with the leader.
 *
 * @example
 *
 * ```typescript
 * interface MyState {
 *   count: number;
 * }
 * interface MyCustomEvent {
 *   type: 'INCREMENT';
 *   payload: number;
 * }
 *
 * // Create a leader store
 * const leaderStore = UniversalStore.create<MyState, MyCustomEvent>({
 *   id: 'my-store',
 *   leader: true,
 *   initialState: { count: 0 },
 * });
 *
 * // Create a follower store
 * const followerStore = UniversalStore.create<MyState, MyCustomEvent>({
 *   id: 'my-store',
 *   leader: false,
 * });
 * ```
 *
 * @template State - The type of state managed by the store
 * @template CustomEvent - Custom events that can be sent through the store. Must have a `type`
 *   string and optional `payload`
 * @throws {Error} If constructed directly instead of using `create()`
 * @throws {Error} If created without setting a channel first
 * @throws {Error} If a follower is created with initial state
 * @throws {Error} If a follower cannot find its leader within 1 second
 */
declare class UniversalStore<State, CustomEvent extends {
    type: string;
    payload?: any;
} = {
    type: string;
    payload?: any;
}> {
    /**
     * Defines the possible actor types in the store system
     *
     * @readonly
     */
    static readonly ActorType: {
        readonly LEADER: "LEADER";
        readonly FOLLOWER: "FOLLOWER";
    };
    /**
     * Defines the possible environments the store can run in
     *
     * @readonly
     */
    static readonly Environment: {
        readonly SERVER: "SERVER";
        readonly MANAGER: "MANAGER";
        readonly PREVIEW: "PREVIEW";
        readonly UNKNOWN: "UNKNOWN";
        readonly MOCK: "MOCK";
    };
    /**
     * Internal event types used for store synchronization
     *
     * @readonly
     */
    static readonly InternalEventType: {
        readonly EXISTING_STATE_REQUEST: "__EXISTING_STATE_REQUEST";
        readonly EXISTING_STATE_RESPONSE: "__EXISTING_STATE_RESPONSE";
        readonly SET_STATE: "__SET_STATE";
        readonly LEADER_CREATED: "__LEADER_CREATED";
        readonly FOLLOWER_CREATED: "__FOLLOWER_CREATED";
    };
    static readonly Status: {
        readonly UNPREPARED: "UNPREPARED";
        readonly SYNCING: "SYNCING";
        readonly READY: "READY";
        readonly ERROR: "ERROR";
    };
    protected static isInternalConstructing: boolean;
    /**
     * The preparation construct is used to keep track of all store's preparation state the promise is
     * resolved when the store is prepared with the static __prepare() method which will also change
     * the state from PENDING to RESOLVED
     */
    private static preparation;
    private static setupPreparationPromise;
    /** Enable debug logs for this store */
    debugging: boolean;
    /** The actor object representing the store instance with a unique ID and a type */
    get actor(): Actor;
    /**
     * The current state of the store, that signals both if the store is prepared by Storybook and
     * also - in the case of a follower - if the state has been synced with the leader's state.
     */
    get status(): StatusType;
    /**
     * A promise that resolves when the store is fully ready. A leader will be ready when the store
     * has been prepared by Storybook, which is almost instantly.
     *
     * A follower will be ready when the state has been synced with the leader's state, within a few
     * hundred milliseconds.
     */
    untilReady(): Promise<[{
        channel: ChannelLike;
        environment: EnvironmentType;
    }, void | undefined]>;
    /**
     * The syncing construct is used to keep track of if the instance's state has been synced with the
     * other instances. A leader will immediately have the promise resolved. A follower will initially
     * be in a PENDING state, and resolve the the leader has sent the existing state, or reject if no
     * leader has responded before the timeout.
     */
    private syncing?;
    private channelEventName;
    private state;
    private channel?;
    private environment?;
    private listeners;
    private id;
    private actorId;
    private actorType;
    protected constructor(options: StoreOptions<State>, environmentOverrides?: EnvironmentOverrides);
    /** Creates a new instance of UniversalStore */
    static create<State = any, CustomEvent extends {
        type: string;
        payload?: any;
    } = {
        type: string;
        payload?: any;
    }>(options: StoreOptions<State>): UniversalStore<State, CustomEvent>;
    /** Gets the current state */
    getState: () => State;
    /**
     * Updates the store's state
     *
     * Either a new state or a state updater function can be passed to the method.
     */
    setState(updater: State | StateUpdater<State>): void;
    /**
     * Subscribes to store events
     *
     * @returns A function to unsubscribe
     */
    subscribe: {
        (listener: Listener<Event<State, CustomEvent>>): () => void;
        <EventType extends Event<State, CustomEvent>['type']>(eventType: EventType, listener: Listener<Extract<Event<State, CustomEvent>, {
            type: EventType;
        }>>): () => void;
    };
    /**
     * Subscribes to state changes
     *
     * @returns Unsubscribe function
     */
    onStateChange(listener: (state: State, previousState: State, eventInfo: EventInfo) => void): () => void;
    /** Sends a custom event to the other stores */
    send: (event: CustomEvent) => void;
    private emitToChannel;
    private prepareThis;
    private emitToListeners;
    private handleChannelEvents;
    private debug;
}

/**
 * A hook to use a UniversalStore in the manager UI (eg. in an addon panel). This hook will react to
 * changes in the store state and re-render when the store changes.
 *
 * @param universalStore The UniversalStore instance to use.
 * @param selector An optional selector function to select a subset of the store state.
 * @remark This hook is intended for use in the manager UI. For use in the preview, import from
 * `storybook/preview-api` instead.
 */
declare const useUniversalStore: {
    <TUniversalStore extends UniversalStore<TState, any>, TState = TUniversalStore extends UniversalStore<infer S, any> ? S : never>(universalStore: TUniversalStore): [TState, TUniversalStore['setState']];
    <TUniversalStore extends UniversalStore<any, any>, TSelectedState, TState = TUniversalStore extends UniversalStore<infer S, any> ? S : never>(universalStore: TUniversalStore, selector: (state: TState) => TSelectedState): [TSelectedState, TUniversalStore['setState']];
};

/**
 * A mock universal store that can be used when testing code that relies on a universal store. It
 * functions exactly like a normal universal store, with a few exceptions:
 *
 * - It is fully isolated, meaning that it doesn't interact with any channel, and it is always a
 *   leader.
 *
 * If the second testUtils argument is provided, all the public methods are spied on, so they can be
 * asserted.
 *
 * When a mock store is re-used across tests (eg. in stories), you manually need to reset the state
 * after each test.
 *
 * @example
 *
 * ```ts
 * import * as testUtils from 'storybook/test'; // in stories
 * import { vi as testUtils } from 'vitest'; // ... or in Vitest tests
 *
 * const initialState = { ... };
 * const store = new MockUniversalStore({ initialState }, testUtils);
 *
 * export default {
 *   title: 'My story',
 *   beforeEach: () => {
 *     return () => {
 *       store.setState(initialState);
 *     };
 *   }
 * }
 * ```
 */
declare class MockUniversalStore<State, CustomEvent extends {
    type: string;
    payload?: any;
} = {
    type: string;
    payload?: any;
}> extends UniversalStore<State, CustomEvent> {
    private testUtils;
    constructor(options: StoreOptions<State>, testUtils?: any);
    /** Create a mock universal store. This is just an alias for the constructor */
    static create<State = any, CustomEvent extends {
        type: string;
        payload?: any;
    } = {
        type: string;
        payload?: any;
    }>(options: StoreOptions<State>, testUtils?: any): MockUniversalStore<State, CustomEvent>;
    unsubscribeAll(): void;
}

type StatusValue = 'status-value:pending' | 'status-value:success' | 'status-value:error' | 'status-value:warning' | 'status-value:unknown';
type StatusTypeId = string;
type StatusByTypeId = Record<StatusTypeId, Status>;
type StatusesByStoryIdAndTypeId = Record<StoryId$1, StatusByTypeId>;
interface Status {
    value: StatusValue;
    typeId: StatusTypeId;
    storyId: StoryId$1;
    title: string;
    description: string;
    data?: any;
    sidebarContextMenu?: boolean;
}
declare const StatusStoreEventType: {
    readonly SELECT: "select";
};
type StatusStoreEvent = {
    type: typeof StatusStoreEventType.SELECT;
    payload: Status[];
};
type StatusStore = {
    getAll: () => StatusesByStoryIdAndTypeId;
    set: (statuses: Status[]) => void;
    onAllStatusChange: (listener: (statuses: StatusesByStoryIdAndTypeId, previousStatuses: StatusesByStoryIdAndTypeId) => void) => () => void;
    onSelect: (listener: (selectedStatuses: Status[]) => void) => () => void;
    unset: (storyIds?: StoryId$1[]) => void;
};
type StatusStoreByTypeId = StatusStore & {
    typeId: StatusTypeId;
};
type UseStatusStore = <T = StatusesByStoryIdAndTypeId>(selector?: (statuses: StatusesByStoryIdAndTypeId) => T) => T;

/**
 * Actions represent the type of change to a location value.
 */
declare enum Action {
    /**
     * A POP indicates a change to an arbitrary index in the history stack, such
     * as a back or forward navigation. It does not describe the direction of the
     * navigation, only that the current index changed.
     *
     * Note: This is the default action for newly created history objects.
     */
    Pop = "POP",
    /**
     * A PUSH indicates a new entry being added to the history stack, such as when
     * a link is clicked and a new page loads. When this happens, all subsequent
     * entries in the stack are lost.
     */
    Push = "PUSH",
    /**
     * A REPLACE indicates the entry at the current index in the history stack
     * being replaced by a new one.
     */
    Replace = "REPLACE"
}
/**
 * The pathname, search, and hash values of a URL.
 */
interface Path {
    /**
     * A URL pathname, beginning with a /.
     */
    pathname: string;
    /**
     * A URL search string, beginning with a ?.
     */
    search: string;
    /**
     * A URL fragment identifier, beginning with a #.
     */
    hash: string;
}
/**
 * An entry in a history stack. A location contains information about the
 * URL path, as well as possibly some arbitrary state and a key.
 */
interface Location extends Path {
    /**
     * A value of arbitrary data associated with this location.
     */
    state: any;
    /**
     * A unique string associated with this location. May be used to safely store
     * and retrieve data in some other storage API, like `localStorage`.
     *
     * Note: This value is always "default" on the initial location.
     */
    key: string;
}

/**
 * Map of routeId -> data returned from a loader/action/error
 */
interface RouteData {
    [routeId: string]: any;
}
declare enum ResultType {
    data = "data",
    deferred = "deferred",
    redirect = "redirect",
    error = "error"
}
/**
 * Successful result from a loader or action
 */
interface SuccessResult {
    type: ResultType.data;
    data: any;
    statusCode?: number;
    headers?: Headers;
}
/**
 * Successful defer() result from a loader or action
 */
interface DeferredResult {
    type: ResultType.deferred;
    deferredData: DeferredData;
    statusCode?: number;
    headers?: Headers;
}
/**
 * Redirect result from a loader or action
 */
interface RedirectResult {
    type: ResultType.redirect;
    status: number;
    location: string;
    revalidate: boolean;
    reloadDocument?: boolean;
}
/**
 * Unsuccessful result from a loader or action
 */
interface ErrorResult {
    type: ResultType.error;
    error: any;
    headers?: Headers;
}
/**
 * Result from a loader or action - potentially successful or unsuccessful
 */
type DataResult = SuccessResult | DeferredResult | RedirectResult | ErrorResult;
type LowerCaseFormMethod = "get" | "post" | "put" | "patch" | "delete";
type UpperCaseFormMethod = Uppercase<LowerCaseFormMethod>;
/**
 * Active navigation/fetcher form methods are exposed in lowercase on the
 * RouterState
 */
type FormMethod = LowerCaseFormMethod;
/**
 * In v7, active navigation/fetcher form methods are exposed in uppercase on the
 * RouterState.  This is to align with the normalization done via fetch().
 */
type V7_FormMethod = UpperCaseFormMethod;
type FormEncType = "application/x-www-form-urlencoded" | "multipart/form-data" | "application/json" | "text/plain";
type JsonObject = {
    [Key in string]: JsonValue;
} & {
    [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
/**
 * @private
 * Internal interface to pass around for action submissions, not intended for
 * external consumption
 */
type Submission = {
    formMethod: FormMethod | V7_FormMethod;
    formAction: string;
    formEncType: FormEncType;
    formData: FormData;
    json: undefined;
    text: undefined;
} | {
    formMethod: FormMethod | V7_FormMethod;
    formAction: string;
    formEncType: FormEncType;
    formData: undefined;
    json: JsonValue;
    text: undefined;
} | {
    formMethod: FormMethod | V7_FormMethod;
    formAction: string;
    formEncType: FormEncType;
    formData: undefined;
    json: undefined;
    text: string;
};
/**
 * @private
 * Arguments passed to route loader/action functions.  Same for now but we keep
 * this as a private implementation detail in case they diverge in the future.
 */
interface DataFunctionArgs {
    request: Request;
    params: Params;
    context?: any;
}
/**
 * Arguments passed to loader functions
 */
interface LoaderFunctionArgs extends DataFunctionArgs {
}
/**
 * Arguments passed to action functions
 */
interface ActionFunctionArgs extends DataFunctionArgs {
}
/**
 * Loaders and actions can return anything except `undefined` (`null` is a
 * valid return value if there is no data to return).  Responses are preferred
 * and will ease any future migration to Remix
 */
type DataFunctionValue = Response | NonNullable<unknown> | null;
/**
 * Route loader function signature
 */
interface LoaderFunction {
    (args: LoaderFunctionArgs): Promise<DataFunctionValue> | DataFunctionValue;
}
/**
 * Route action function signature
 */
interface ActionFunction {
    (args: ActionFunctionArgs): Promise<DataFunctionValue> | DataFunctionValue;
}
/**
 * Route shouldRevalidate function signature.  This runs after any submission
 * (navigation or fetcher), so we flatten the navigation/fetcher submission
 * onto the arguments.  It shouldn't matter whether it came from a navigation
 * or a fetcher, what really matters is the URLs and the formData since loaders
 * have to re-run based on the data models that were potentially mutated.
 */
interface ShouldRevalidateFunction {
    (args: {
        currentUrl: URL;
        currentParams: AgnosticDataRouteMatch["params"];
        nextUrl: URL;
        nextParams: AgnosticDataRouteMatch["params"];
        formMethod?: Submission["formMethod"];
        formAction?: Submission["formAction"];
        formEncType?: Submission["formEncType"];
        text?: Submission["text"];
        formData?: Submission["formData"];
        json?: Submission["json"];
        actionResult?: DataResult;
        defaultShouldRevalidate: boolean;
    }): boolean;
}
/**
 * Keys we cannot change from within a lazy() function. We spread all other keys
 * onto the route. Either they're meaningful to the router, or they'll get
 * ignored.
 */
type ImmutableRouteKey = "lazy" | "caseSensitive" | "path" | "id" | "index" | "children";
type RequireOne<T, Key = keyof T> = Exclude<{
    [K in keyof T]: K extends Key ? Omit<T, K> & Required<Pick<T, K>> : never;
}[keyof T], undefined>;
/**
 * lazy() function to load a route definition, which can add non-matching
 * related properties to a route
 */
interface LazyRouteFunction<R extends AgnosticRouteObject> {
    (): Promise<RequireOne<Omit<R, ImmutableRouteKey>>>;
}
/**
 * Base RouteObject with common props shared by all types of routes
 */
type AgnosticBaseRouteObject = {
    caseSensitive?: boolean;
    path?: string;
    id?: string;
    loader?: LoaderFunction;
    action?: ActionFunction;
    hasErrorBoundary?: boolean;
    shouldRevalidate?: ShouldRevalidateFunction;
    handle?: any;
    lazy?: LazyRouteFunction<AgnosticBaseRouteObject>;
};
/**
 * Index routes must not have children
 */
type AgnosticIndexRouteObject = AgnosticBaseRouteObject & {
    children?: undefined;
    index: true;
};
/**
 * Non-index routes may have children, but cannot have index
 */
type AgnosticNonIndexRouteObject = AgnosticBaseRouteObject & {
    children?: AgnosticRouteObject[];
    index?: false;
};
/**
 * A route object represents a logical route, with (optionally) its child
 * routes organized in a tree-like structure.
 */
type AgnosticRouteObject = AgnosticIndexRouteObject | AgnosticNonIndexRouteObject;
type AgnosticDataIndexRouteObject = AgnosticIndexRouteObject & {
    id: string;
};
type AgnosticDataNonIndexRouteObject = AgnosticNonIndexRouteObject & {
    children?: AgnosticDataRouteObject[];
    id: string;
};
/**
 * A data route object, which is just a RouteObject with a required unique ID
 */
type AgnosticDataRouteObject = AgnosticDataIndexRouteObject | AgnosticDataNonIndexRouteObject;
/**
 * The parameters that were parsed from the URL path.
 */
type Params<Key extends string = string> = {
    readonly [key in Key]: string | undefined;
};
/**
 * A RouteMatch contains info about how a route matched a URL.
 */
interface AgnosticRouteMatch<ParamKey extends string = string, RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject> {
    /**
     * The names and values of dynamic parameters in the URL.
     */
    params: Params<ParamKey>;
    /**
     * The portion of the URL pathname that was matched.
     */
    pathname: string;
    /**
     * The portion of the URL pathname that was matched before child routes.
     */
    pathnameBase: string;
    /**
     * The route object that was used to match.
     */
    route: RouteObjectType;
}
interface AgnosticDataRouteMatch extends AgnosticRouteMatch<string, AgnosticDataRouteObject> {
}
declare class DeferredData {
    private pendingKeysSet;
    private controller;
    private abortPromise;
    private unlistenAbortSignal;
    private subscribers;
    data: Record<string, unknown>;
    init?: ResponseInit;
    deferredKeys: string[];
    constructor(data: Record<string, unknown>, responseInit?: ResponseInit);
    private trackPromise;
    private onSettle;
    private emit;
    subscribe(fn: (aborted: boolean, settledKey?: string) => void): () => boolean;
    cancel(): void;
    resolveData(signal: AbortSignal): Promise<boolean>;
    get done(): boolean;
    get unwrappedData(): {};
    get pendingKeys(): string[];
}

/**
 * State maintained internally by the router.  During a navigation, all states
 * reflect the the "old" location unless otherwise noted.
 */
interface RouterState {
    /**
     * The action of the most recent navigation
     */
    historyAction: Action;
    /**
     * The current location reflected by the router
     */
    location: Location;
    /**
     * The current set of route matches
     */
    matches: AgnosticDataRouteMatch[];
    /**
     * Tracks whether we've completed our initial data load
     */
    initialized: boolean;
    /**
     * Current scroll position we should start at for a new view
     *  - number -> scroll position to restore to
     *  - false -> do not restore scroll at all (used during submissions)
     *  - null -> don't have a saved position, scroll to hash or top of page
     */
    restoreScrollPosition: number | false | null;
    /**
     * Indicate whether this navigation should skip resetting the scroll position
     * if we are unable to restore the scroll position
     */
    preventScrollReset: boolean;
    /**
     * Tracks the state of the current navigation
     */
    navigation: Navigation;
    /**
     * Tracks any in-progress revalidations
     */
    revalidation: RevalidationState;
    /**
     * Data from the loaders for the current matches
     */
    loaderData: RouteData;
    /**
     * Data from the action for the current matches
     */
    actionData: RouteData | null;
    /**
     * Errors caught from loaders for the current matches
     */
    errors: RouteData | null;
    /**
     * Map of current fetchers
     */
    fetchers: Map<string, Fetcher>;
    /**
     * Map of current blockers
     */
    blockers: Map<string, Blocker>;
}
/**
 * Data that can be passed into hydrate a Router from SSR
 */
type HydrationState = Partial<Pick<RouterState, "loaderData" | "actionData" | "errors">>;
/**
 * Potential states for state.navigation
 */
type NavigationStates = {
    Idle: {
        state: "idle";
        location: undefined;
        formMethod: undefined;
        formAction: undefined;
        formEncType: undefined;
        formData: undefined;
        json: undefined;
        text: undefined;
    };
    Loading: {
        state: "loading";
        location: Location;
        formMethod: Submission["formMethod"] | undefined;
        formAction: Submission["formAction"] | undefined;
        formEncType: Submission["formEncType"] | undefined;
        formData: Submission["formData"] | undefined;
        json: Submission["json"] | undefined;
        text: Submission["text"] | undefined;
    };
    Submitting: {
        state: "submitting";
        location: Location;
        formMethod: Submission["formMethod"];
        formAction: Submission["formAction"];
        formEncType: Submission["formEncType"];
        formData: Submission["formData"];
        json: Submission["json"];
        text: Submission["text"];
    };
};
type Navigation = NavigationStates[keyof NavigationStates];
type RevalidationState = "idle" | "loading";
/**
 * Potential states for fetchers
 */
type FetcherStates<TData = any> = {
    Idle: {
        state: "idle";
        formMethod: undefined;
        formAction: undefined;
        formEncType: undefined;
        text: undefined;
        formData: undefined;
        json: undefined;
        data: TData | undefined;
        " _hasFetcherDoneAnything "?: boolean;
    };
    Loading: {
        state: "loading";
        formMethod: Submission["formMethod"] | undefined;
        formAction: Submission["formAction"] | undefined;
        formEncType: Submission["formEncType"] | undefined;
        text: Submission["text"] | undefined;
        formData: Submission["formData"] | undefined;
        json: Submission["json"] | undefined;
        data: TData | undefined;
        " _hasFetcherDoneAnything "?: boolean;
    };
    Submitting: {
        state: "submitting";
        formMethod: Submission["formMethod"];
        formAction: Submission["formAction"];
        formEncType: Submission["formEncType"];
        text: Submission["text"];
        formData: Submission["formData"];
        json: Submission["json"];
        data: TData | undefined;
        " _hasFetcherDoneAnything "?: boolean;
    };
};
type Fetcher<TData = any> = FetcherStates<TData>[keyof FetcherStates<TData>];
interface BlockerBlocked {
    state: "blocked";
    reset(): void;
    proceed(): void;
    location: Location;
}
interface BlockerUnblocked {
    state: "unblocked";
    reset: undefined;
    proceed: undefined;
    location: undefined;
}
interface BlockerProceeding {
    state: "proceeding";
    reset: undefined;
    proceed: undefined;
    location: Location;
}
type Blocker = BlockerUnblocked | BlockerBlocked | BlockerProceeding;

/**
 * NOTE: If you refactor this to split up the modules into separate files,
 * you'll need to update the rollup config for react-router-dom-v5-compat.
 */

declare global {
    var __staticRouterHydrationData: HydrationState | undefined;
}

declare global {
	interface SymbolConstructor {
		readonly observable: symbol;
	}
}

declare global {
    var globalProjectAnnotations: NormalizedProjectAnnotations<any>;
    var defaultProjectAnnotations: ProjectAnnotations<any>;
}
type WrappedStoryRef = {
    __pw_type: 'jsx';
    props: Record<string, any>;
} | {
    __pw_type: 'importRef';
};
type UnwrappedJSXStoryRef = {
    __pw_type: 'jsx';
    type: UnwrappedImportStoryRef;
};
type UnwrappedImportStoryRef = ComposedStoryFn;
declare global {
    function __pwUnwrapObject(storyRef: WrappedStoryRef): Promise<UnwrappedJSXStoryRef | UnwrappedImportStoryRef>;
}

type TestProviderState = 'test-provider-state:pending' | 'test-provider-state:running' | 'test-provider-state:succeeded' | 'test-provider-state:crashed';
type TestProviderId = string;
type TestProviderStateByProviderId = Record<TestProviderId, TestProviderState>;
type TestProviderStoreEventType = 'run-all' | 'clear-all' | 'settings-changed';
type TestProviderStoreEvent = BaseEvent & {
    type: TestProviderStoreEventType;
};
type BaseTestProviderStore = {
    /**
     * Notifies all listeners that settings have changed for test providers. The Storybook UI will
     * highlight the test providers to tell the user that settings has changed.
     */
    settingsChanged: () => void;
    /**
     * Subscribe to clicks on the "Run All" button, that is supposed to trigger all test providers to
     * run. Your test provider should do the "main thing" when this happens, similar to when the user
     * triggers your test provider specifically.
     *
     * @example
     *
     * ```typescript
     * // Subscribe to run-all events
     * const unsubscribe = myTestProviderStore.onRunAll(() => {
     *   await runAllMyTests();
     * });
     * ```
     */
    onRunAll: (listener: () => void) => () => void;
    /**
     * Subscribe to clicks on the "Clear All" button, that is supposed to clear all state from test
     * providers. Storybook already clears all statuses, but if your test provider has more
     * non-status-based state, you can use this to clear that here.
     *
     * @remarks
     * The purpose of this is _not_ to clear your test provider's settings, only the test results.
     * @example
     *
     * ```typescript
     * // Subscribe to clear-all events
     * const unsubscribe = myTestProviderStore.onClearAll(() => {
     *   clearMyTestResults();
     * });
     *
     * // Later, when no longer needed
     * unsubscribe();
     * ```
     */
    onClearAll: (listener: () => void) => () => void;
};
/**
 * Represents a store for a specific test provider, identified by its unique ID. This store provides
 * methods to manage the state of an individual test provider, including getting and setting its
 * state, running operations with automatic state management, and accessing its unique identifier.
 *
 * Each test provider has its own instance of this store, allowing for independent state management
 * across different test providers in the application.
 *
 * @example
 *
 * ```typescript
 * // Get a store for a specific test provider
 * const grammarStore = getTestProviderStoreById('addon-grammar');
 *
 * // Check the current state
 * if (grammarStore.getState() === 'test-provider-state:pending') {
 *   console.log('Grammar tests are ready to run');
 * }
 *
 * // Run tests with automatic state management
 * grammarStore.runWithState(async () => {
 *   await runGrammarTests();
 * });
 * ```
 *
 * @see {@link TestProviderState} for possible state values
 * @see {@link BaseTestProviderStore} for methods inherited from the base store
 */
type TestProviderStoreById = BaseTestProviderStore & {
    /**
     * Gets the current state of this specific test provider
     *
     * The state represents the current execution status of the test provider, which can be one of the
     * following:
     *
     * - 'test-provider-state:pending': Tests have not been run yet
     * - 'test-provider-state:running': Tests are currently running
     * - 'test-provider-state:succeeded': Tests completed successfully
     * - 'test-provider-state:crashed': Running tests failed or encountered an error
     *
     * Storybook UI will use this state to determine what to show in the UI.
     *
     * @remarks
     * The 'test-provider-state:crashed' is meant to signify that the test run as a whole failed to
     * execute for some reason. It should _not_ be set just because a number of tests failed, use
     * statuses and the status store for that. See {@link TestStatusStore} for managing individual test
     * statuses.
     * @example
     *
     * ```typescript
     * // Get the current state of a specific test provider
     * const state = testProviderStore.getState();
     *
     * // Conditionally render UI based on the state
     * const TestStatus = () => {
     *   const state = testProviderStore.getState();
     *
     *   if (state === 'test-provider-state:running') {
     *     return <Spinner />;
     *   } else if (state === 'test-provider-state:succeeded') {
     *     return <SuccessIcon />;
     *   } else if (state === 'test-provider-state:crashed') {
     *     return <ErrorIcon />;
     *   }
     *
     *   return <PendingIcon />;
     * };
     * ```
     */
    getState: () => TestProviderState;
    /**
     * Sets the state of this specific test provider
     *
     * This method allows you to manually update the execution state of the test provider. It's
     * typically used when you need to reflect the current status of test execution in the UI or when
     * you want to programmatically control the test provider's state.
     *
     * Common use cases include:
     *
     * - Setting to 'running' when tests start
     * - Setting to 'succeeded' when tests complete successfully
     * - Setting to 'crashed' when tests fail or encounter errors
     * - Setting to 'pending' to reset the state
     *
     * The state represents the current execution status of the test provider, which can be one of the
     * following:
     *
     * - 'test-provider-state:pending': Tests have not been run yet
     * - 'test-provider-state:running': Tests are currently running
     * - 'test-provider-state:succeeded': Tests completed successfully
     * - 'test-provider-state:crashed': Running tests failed or encountered an error
     *
     * Storybook UI will use this state to determine what to show in the UI.
     *
     * @remarks
     * The 'test-provider-state:crashed' is meant to signify that the test run as a whole failed to
     * execute for some reason. It should _not_ be set just because a number of tests failed, use
     * statuses and the status store for that. See {@link TestStatusStore} for managing individual test
     * statuses.
     *
     * For most use cases, consider using {@link runWithState} instead, which provides automatic state
     * management and error handling during test execution.
     * @example
     *
     * ```typescript
     * // Update the state when tests start running
     * const startTests = async () => {
     *   testProviderStore.setState('test-provider-state:running');
     *   ... run tests ...
     * };
     * ```
     */
    setState: (state: TestProviderState) => void;
    /**
     * Runs a callback and automatically updates the test provider's state with running, succeeded or
     * crashed, depending on the end result.
     *
     * - Immediately changes the state to 'running'
     * - If the callback returns/resolves, change the state to 'succeeded'.
     * - If the callback throws an error/rejects, change the state to 'crashed'.
     *
     * This approach helps prevent state inconsistencies that might occur if exceptions are thrown
     * during test execution.
     *
     * @example
     *
     * ```typescript
     * // Run tests with automatic state management
     * const runTests = () => {
     *   testProviderStore.runWithState(async () => {
     *     // The state is automatically set to 'running' before this callback
     *
     *     // Run tests here...
     *     const results = await executeTests();
     *   });
     * };
     * ```
     */
    runWithState: (callback: () => void | Promise<void>) => Promise<void>;
    /** The unique identifier for this test provider */
    testProviderId: TestProviderId;
};
/**
 * React OR preview hook for accessing the state of _all_ test providers. This hook will only
 * trigger a re-render when the state changes. It is recommended to pass the optional selector, to
 * get more fine-grained control of re-renders.
 *
 * @example
 *
 * ```typescript
 * const TestStatus = () => {
 *   const state = useTestProviderStore((state) => state['my-test-provider']);
 * };
 * ```
 */
type UseTestProviderStore = <T = TestProviderStateByProviderId>(
/**
 * Optional selector function to extract or transform specific parts of the state
 *
 * @example
 *
 * ```typescript
 * // Use the entire state
 * const allProviderStates = useTestProviderStore();
 *
 * // Get state for a specific provider
 * const myProviderState = useTestProviderStore((state) => state['my-test-provider']);
 *
 * // Get a count of providers in each state
 * const statusCounts = useTestProviderStore((state) => {
 *   const counts = {
 *     pending: 0,
 *     running: 0,
 *     succeeded: 0,
 *     crashed: 0,
 *   };
 *
 *   Object.values(state).forEach((status) => {
 *     if (status === 'test-provider-state:pending') counts.pending++;
 *     else if (status === 'test-provider-state:running') counts.running++;
 *     else if (status === 'test-provider-state:succeeded') counts.succeeded++;
 *     else if (status === 'test-provider-state:crashed') counts.crashed++;
 *   });
 *
 *   return counts;
 * });
 *
 * // Check if all tests have completed
 * const allTestsCompleted = useTestProviderStore((state) => {
 *   return Object.values(state).every(
 *     (status) =>
 *       status === 'test-provider-state:succeeded' ||
 *       status === 'test-provider-state:crashed'
 *   );
 * });
 * ```
 */
selector?: (state: TestProviderStateByProviderId) => T) => T;

declare const fullStatusStore: StatusStore & {
    selectStatuses: (statuses: Status[]) => void;
    typeId: undefined;
};
declare const getStatusStoreByTypeId: (typeId: StatusTypeId) => StatusStoreByTypeId;
declare const useStatusStore: UseStatusStore;
declare const universalStatusStore: UniversalStore<StatusesByStoryIdAndTypeId, StatusStoreEvent>;

declare const fullTestProviderStore: {
    settingsChanged: () => void;
    onRunAll: (listener: () => void) => () => void;
    onClearAll: (listener: () => void) => () => void;
} & {
    getFullState: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>["getState"];
    setFullState: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>["setState"];
    onSettingsChanged: (listener: (testProviderId: TestProviderId) => void) => () => void;
    runAll: () => void;
    clearAll: () => void;
};
declare const getTestProviderStoreById: (testProviderId: TestProviderId) => TestProviderStoreById;
declare const useTestProviderStore: UseTestProviderStore;
declare const universalTestProviderStore: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>;

export { type API, type API_EventMap, ActiveTabs, AddonStore, type Combo, ManagerConsumer as Consumer, type KeyboardEventLike, ManagerContext, type ManagerProviderProps, ManagerProvider as Provider, RequestResponseError, type State, type Options as StoreOptions, addons, combineParameters, controlOrMetaKey, controlOrMetaSymbol, eventMatchesShortcut, eventToShortcut, MockUniversalStore as experimental_MockUniversalStore, UniversalStore as experimental_UniversalStore, getStatusStoreByTypeId as experimental_getStatusStore, getTestProviderStoreById as experimental_getTestProviderStore, experimental_requestResponse, useStatusStore as experimental_useStatusStore, useTestProviderStore as experimental_useTestProviderStore, useUniversalStore as experimental_useUniversalStore, fullStatusStore as internal_fullStatusStore, fullTestProviderStore as internal_fullTestProviderStore, universalStatusStore as internal_universalStatusStore, universalTestProviderStore as internal_universalTestProviderStore, isMacLike, isShortcutTaken, keyToSymbol, _default as merge, mockChannel, optionOrAltSymbol, shortcutMatchesShortcut, shortcutToHumanString, typesX as types, useAddonState, useArgTypes, useArgs, useChannel, useGlobalTypes, useGlobals, useParameter, useSharedState, useStoryPrepared, useStorybookApi, useStorybookState };
