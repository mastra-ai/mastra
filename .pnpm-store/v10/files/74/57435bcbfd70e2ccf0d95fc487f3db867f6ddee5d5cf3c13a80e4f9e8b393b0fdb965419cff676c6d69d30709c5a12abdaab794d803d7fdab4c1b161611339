import { IDetachable } from "./IDetachable.js";
import { IStringDictionary } from "./IDictionary.js";
import { IDisposable } from "./IDisposable.js";
import { PlatformEvent } from "./PlatformEvent.js";
import { IEventListener } from "./IEventListener.js";
export interface IEventSource<TEvent extends PlatformEvent> extends IDisposable {
    metadata: IStringDictionary<string>;
    onEvent(e: TEvent): void;
    attach(onEventCallback: (event: TEvent) => void): IDetachable;
    attachListener(listener: IEventListener<TEvent>): IDetachable;
    attachConsoleListener(listener: IEventListener<TEvent>): IDetachable;
}
