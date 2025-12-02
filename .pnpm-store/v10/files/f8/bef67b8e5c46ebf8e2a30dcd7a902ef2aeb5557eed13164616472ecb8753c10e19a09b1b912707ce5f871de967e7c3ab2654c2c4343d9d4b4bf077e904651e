/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { BaseRawConnection } from "./baseConn";
export declare class RawConnection extends BaseRawConnection {
    private config;
    private sock;
    private paused;
    private _onConnect;
    private _onClose;
    protected _onError(err: Error): void;
    private _onData;
    protected _waitForMessage(): Promise<void>;
    protected _sendData(data: Uint8Array): void;
    protected _abort(): void;
    close(): Promise<void>;
    protected connect(): Promise<void>;
    private _authSasl;
    private _ensureMessage;
}
