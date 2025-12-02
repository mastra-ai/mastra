/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2022 Google Inc.
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
/**
 * `SettableProcessingState` represents all the processing states that can be set
 * on an Extension instance's runtime data.
 *
 * @remarks
 * You can set the following states:
 *
 * - `NONE`: No relevant lifecycle event work has been done.
 *   Set this to clear out old statuses.
 *
 * - `PROCESSING_COMPLETE`: Lifecycle event work completed with no errors.
 *
 * - `PROCESSING_WARNING`: Lifecycle event work succeeded partially, or
 *   something happened that the user should be warned about.
 *
 * - `PROCESSING_FAILED`: Lifecycle event work failed completely, but the
 *   instance will still work correctly going forward.
 *
 * If the extension instance is in a broken state due to errors, instead call
 * {@link Runtime.setFatalError}.
 *
 * The "processing" state gets set automatically when a lifecycle event handler
 * starts; you can't set it explicitly.
 * To report the ongoing status of an extension's function, use `console.log`
 * or the Cloud Functions logger SDK.
 */
export type SettableProcessingState = 'NONE' | 'PROCESSING_COMPLETE' | 'PROCESSING_WARNING' | 'PROCESSING_FAILED';
