/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2021 Google Inc.
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
 * Interface representing task options with delayed delivery.
 */
export interface DelayDelivery {
    /**
     * The duration of delay of the time when the task is scheduled to be attempted or retried.
     * This delay is added to the current time.
     */
    scheduleDelaySeconds?: number;
    /** @alpha */
    scheduleTime?: never;
}
/**
 * Interface representing task options with absolute delivery.
 */
export interface AbsoluteDelivery {
    /**
     * The time when the task is scheduled to be attempted or retried.
     */
    scheduleTime?: Date;
    /** @alpha */
    scheduleDelaySeconds?: never;
}
/**
 * Type representing delivery schedule options.
 * `DeliverySchedule` is a union type of {@link DelayDelivery} and {@link AbsoluteDelivery} types.
 */
export type DeliverySchedule = DelayDelivery | AbsoluteDelivery;
/**
 * Type representing task options.
 */
export type TaskOptions = DeliverySchedule & TaskOptionsExperimental & {
    /**
     * The deadline for requests sent to the worker. If the worker does not respond by this deadline
     * then the request is cancelled and the attempt is marked as a DEADLINE_EXCEEDED failure.
     * Cloud Tasks will retry the task according to the `RetryConfig`.
     * The default is 10 minutes. The deadline must be in the range of 15 seconds and 30 minutes.
     */
    dispatchDeadlineSeconds?: number;
    /**
     * The ID to use for the enqueued event.
     * If not provided, one will be automatically generated.
     * If provided, an explicitly specified task ID enables task de-duplication. If a task's ID is
     * identical to that of an existing task or a task that was deleted or executed recently then
     * the call will throw an error with code "functions/task-already-exists". Another task with
     * the same ID can't be created for ~1hour after the original task was deleted or executed.
     *
     * Because there is an extra lookup cost to identify duplicate task IDs, setting ID
     * significantly increases latency. Using hashed strings for the task ID or for the prefix of
     * the task ID is recommended. Choosing task IDs that are sequential or have sequential
     * prefixes, for example using a timestamp, causes an increase in latency and error rates in
     * all task commands. The infrastructure relies on an approximately uniform distribution of
     * task IDs to store and serve tasks efficiently.
     *
     * "Push IDs" from the Firebase Realtime Database make poor IDs because they are based on
     * timestamps and will cause contention (slowdowns) in your task queue. Reversed push IDs
     * however form a perfect distribution and are an ideal key. To reverse a string in
     * javascript use `someString.split("").reverse().join("")`
     */
    id?: string;
    /**
     * HTTP request headers to include in the request to the task queue function.
     * These headers represent a subset of the headers that will accompany the task's HTTP
     * request. Some HTTP request headers will be ignored or replaced, e.g. Authorization, Host, Content-Length,
     * User-Agent etc. cannot be overridden.
     *
     * By default, Content-Type is set to 'application/json'.
     *
     * The size of the headers must be less than 80KB.
     */
    headers?: Record<string, string>;
};
/**
 * Type representing experimental (beta) task options.
 */
export interface TaskOptionsExperimental {
    /**
   * The full URL path that the request will be sent to. Must be a valid URL.
   * @beta
   */
    uri?: string;
}
