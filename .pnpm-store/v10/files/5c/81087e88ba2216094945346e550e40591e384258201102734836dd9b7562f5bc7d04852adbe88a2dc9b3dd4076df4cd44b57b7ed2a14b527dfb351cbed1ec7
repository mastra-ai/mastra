/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2017 Google Inc.
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
const firebase = require("./default-namespace");
// Only Node.js has a process variable that is of [[Class]] process
const processGlobal = typeof process !== 'undefined' ? process : 0;
if (Object.prototype.toString.call(processGlobal) !== '[object process]') {
    const message = `
======== WARNING! ========

firebase-admin appears to have been installed in an unsupported environment.
This package should only be used in server-side or backend Node.js environments,
and should not be used in web browsers or other client-side environments.

Use the Firebase JS SDK for client-side Firebase integrations:

https://firebase.google.com/docs/web/setup
`;
    // tslint:disable-next-line:no-console
    console.error(message);
}
module.exports = firebase;
