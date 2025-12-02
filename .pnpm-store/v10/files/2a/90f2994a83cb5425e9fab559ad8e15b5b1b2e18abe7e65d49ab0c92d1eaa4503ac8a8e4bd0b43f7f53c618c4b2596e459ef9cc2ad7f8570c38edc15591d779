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
export declare const EventAccumulatorFactory: {
    waitsForCount: (maxCount: any) => EventAccumulator;
    waitsForExactCount: (maxCount: any) => EventAccumulator;
};
export declare class EventAccumulator {
    condition: Function;
    eventData: any[];
    promise: any;
    resolve: any;
    reject: any;
    private onResetFxn;
    private onEventFxn;
    constructor(condition: Function);
    addEvent(eventData?: any): void;
    reset(condition?: Function): void;
    onEvent(cb: Function): void;
    onReset(cb: Function): void;
    _testCondition(): any;
}
