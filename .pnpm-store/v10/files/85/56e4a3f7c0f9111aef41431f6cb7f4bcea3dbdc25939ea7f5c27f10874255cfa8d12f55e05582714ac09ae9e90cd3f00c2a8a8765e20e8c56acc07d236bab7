"use strict";
// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugMessage = void 0;
/**
 * Represents a debug message the user might want to print out for logging
 * while debugging or whatnot. These will always come by way of the 'error'
 * channel on streams or other event emitters. It's completely fine to
 * ignore them, as some will just be verbose logging info, but they may
 * help figure out what's going wrong. Support may also ask you to catch
 * these channels, which you can do like so:
 *
 * ```
 * subscription.on('debug', msg => console.log(msg.message));
 * ```
 *
 * These values are _not_ guaranteed to remain stable, even within a major
 * version, so don't depend on them for your program logic. Debug outputs
 * may be added or removed at any time, without warning.
 */
class DebugMessage {
    message;
    error;
    constructor(message, error) {
        this.message = message;
        this.error = error;
    }
}
exports.DebugMessage = DebugMessage;
//# sourceMappingURL=debug.js.map