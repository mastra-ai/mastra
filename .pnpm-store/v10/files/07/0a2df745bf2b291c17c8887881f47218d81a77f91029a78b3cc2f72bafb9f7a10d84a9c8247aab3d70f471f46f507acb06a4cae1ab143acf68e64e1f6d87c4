import { ClerkEventPayload } from '@clerk/types';

declare const clerkEvents: {
    Status: "status";
};
declare const createClerkEventBus: () => {
    on: <Event extends "status">(event: Event, handler: (payload: ClerkEventPayload[Event]) => void, opts?: {
        notify?: boolean;
    }) => void;
    prioritizedOn: <Event extends "status">(event: Event, handler: (payload: ClerkEventPayload[Event]) => void) => void;
    emit: <Event extends "status">(event: Event, payload: ClerkEventPayload[Event]) => void;
    off: <Event extends "status">(event: Event, handler?: ((payload: ClerkEventPayload[Event]) => void) | undefined) => void;
    prioritizedOff: <Event extends "status">(event: Event, handler?: ((payload: ClerkEventPayload[Event]) => void) | undefined) => void;
    internal: {
        retrieveListeners: <Event extends "status">(event: Event) => Array<(...args: any[]) => void>;
    };
};

export { clerkEvents, createClerkEventBus };
