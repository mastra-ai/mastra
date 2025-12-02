/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { RepoInfo } from '../core/RepoInfo';
import { PacketReceiver } from './polling/PacketReceiver';
import { Transport } from './Transport';
export declare const FIREBASE_LONGPOLL_START_PARAM = "start";
export declare const FIREBASE_LONGPOLL_CLOSE_COMMAND = "close";
export declare const FIREBASE_LONGPOLL_COMMAND_CB_NAME = "pLPCommand";
export declare const FIREBASE_LONGPOLL_DATA_CB_NAME = "pRTLPCB";
export declare const FIREBASE_LONGPOLL_ID_PARAM = "id";
export declare const FIREBASE_LONGPOLL_PW_PARAM = "pw";
export declare const FIREBASE_LONGPOLL_SERIAL_PARAM = "ser";
export declare const FIREBASE_LONGPOLL_CALLBACK_ID_PARAM = "cb";
export declare const FIREBASE_LONGPOLL_SEGMENT_NUM_PARAM = "seg";
export declare const FIREBASE_LONGPOLL_SEGMENTS_IN_PACKET = "ts";
export declare const FIREBASE_LONGPOLL_DATA_PARAM = "d";
export declare const FIREBASE_LONGPOLL_DISCONN_FRAME_PARAM = "disconn";
export declare const FIREBASE_LONGPOLL_DISCONN_FRAME_REQUEST_PARAM = "dframe";
/**
 * This class manages a single long-polling connection.
 */
export declare class BrowserPollConnection implements Transport {
    connId: string;
    repoInfo: RepoInfo;
    private applicationId?;
    private appCheckToken?;
    private authToken?;
    transportSessionId?: string;
    lastSessionId?: string;
    bytesSent: number;
    bytesReceived: number;
    urlFn: (params: object) => string;
    scriptTagHolder: FirebaseIFrameScriptHolder;
    myDisconnFrame: HTMLIFrameElement;
    curSegmentNum: number;
    myPacketOrderer: PacketReceiver;
    id: string;
    password: string;
    private log_;
    private stats_;
    private everConnected_;
    private isClosed_;
    private connectTimeoutTimer_;
    private onDisconnect_;
    /**
     * @param connId An identifier for this connection, used for logging
     * @param repoInfo The info for the endpoint to send data to.
     * @param applicationId The Firebase App ID for this project.
     * @param appCheckToken The AppCheck token for this client.
     * @param authToken The AuthToken to use for this connection.
     * @param transportSessionId Optional transportSessionid if we are
     * reconnecting for an existing transport session
     * @param lastSessionId Optional lastSessionId if the PersistentConnection has
     * already created a connection previously
     */
    constructor(connId: string, repoInfo: RepoInfo, applicationId?: string, appCheckToken?: string, authToken?: string, transportSessionId?: string, lastSessionId?: string);
    /**
     * @param onMessage - Callback when messages arrive
     * @param onDisconnect - Callback with connection lost.
     */
    open(onMessage: (msg: {}) => void, onDisconnect: (a?: boolean) => void): void;
    /**
     * Call this when a handshake has completed successfully and we want to consider the connection established
     */
    start(): void;
    static forceAllow_: boolean;
    /**
     * Forces long polling to be considered as a potential transport
     */
    static forceAllow(): void;
    static forceDisallow_: boolean;
    /**
     * Forces longpolling to not be considered as a potential transport
     */
    static forceDisallow(): void;
    static isAvailable(): boolean;
    /**
     * No-op for polling
     */
    markConnectionHealthy(): void;
    /**
     * Stops polling and cleans up the iframe
     */
    private shutdown_;
    /**
     * Triggered when this transport is closed
     */
    private onClosed_;
    /**
     * External-facing close handler. RealTime has requested we shut down. Kill our connection and tell the server
     * that we've left.
     */
    close(): void;
    /**
     * Send the JSON object down to the server. It will need to be stringified, base64 encoded, and then
     * broken into chunks (since URLs have a small maximum length).
     * @param data - The JSON data to transmit.
     */
    send(data: {}): void;
    /**
     * This is how we notify the server that we're leaving.
     * We aren't able to send requests with DHTML on a window close event, but we can
     * trigger XHR requests in some browsers (everything but Opera basically).
     */
    addDisconnectPingFrame(id: string, pw: string): void;
    /**
     * Used to track the bytes received by this client
     */
    private incrementIncomingBytes_;
}
export interface IFrameElement extends HTMLIFrameElement {
    doc: Document;
}
/*********************************************************************************************
 * A wrapper around an iframe that is used as a long-polling script holder.
 *********************************************************************************************/
export declare class FirebaseIFrameScriptHolder {
    onDisconnect: () => void;
    urlFn: (a: object) => string;
    outstandingRequests: Set<number>;
    pendingSegs: Array<{
        seg: number;
        ts: number;
        d: unknown;
    }>;
    currentSerial: number;
    sendNewPolls: boolean;
    uniqueCallbackIdentifier: number;
    myIFrame: IFrameElement;
    alive: boolean;
    myID: string;
    myPW: string;
    commandCB: (command: string, ...args: unknown[]) => void;
    onMessageCB: (...args: unknown[]) => void;
    /**
     * @param commandCB - The callback to be called when control commands are received from the server.
     * @param onMessageCB - The callback to be triggered when responses arrive from the server.
     * @param onDisconnect - The callback to be triggered when this tag holder is closed
     * @param urlFn - A function that provides the URL of the endpoint to send data to.
     */
    constructor(commandCB: (command: string, ...args: unknown[]) => void, onMessageCB: (...args: unknown[]) => void, onDisconnect: () => void, urlFn: (a: object) => string);
    /**
     * Each browser has its own funny way to handle iframes. Here we mush them all together into one object that I can
     * actually use.
     */
    private static createIFrame_;
    /**
     * Cancel all outstanding queries and remove the frame.
     */
    close(): void;
    /**
     * Actually start the long-polling session by adding the first script tag(s) to the iframe.
     * @param id - The ID of this connection
     * @param pw - The password for this connection
     */
    startLongPoll(id: string, pw: string): void;
    /**
     * This is called any time someone might want a script tag to be added. It adds a script tag when there aren't
     * too many outstanding requests and we are still alive.
     *
     * If there are outstanding packet segments to send, it sends one. If there aren't, it sends a long-poll anyways if
     * needed.
     */
    private newRequest_;
    /**
     * Queue a packet for transmission to the server.
     * @param segnum - A sequential id for this packet segment used for reassembly
     * @param totalsegs - The total number of segments in this packet
     * @param data - The data for this segment.
     */
    enqueueSegment(segnum: number, totalsegs: number, data: unknown): void;
    /**
     * Add a script tag for a regular long-poll request.
     * @param url - The URL of the script tag.
     * @param serial - The serial number of the request.
     */
    private addLongPollTag_;
    /**
     * Add an arbitrary script tag to the iframe.
     * @param url - The URL for the script tag source.
     * @param loadCB - A callback to be triggered once the script has loaded.
     */
    addTag(url: string, loadCB: () => void): void;
}
