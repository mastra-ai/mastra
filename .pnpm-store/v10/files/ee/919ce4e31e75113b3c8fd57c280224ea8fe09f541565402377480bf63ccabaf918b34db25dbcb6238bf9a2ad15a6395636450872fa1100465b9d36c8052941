/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventarcApiClient = void 0;
const validator = require("../utils/validator");
const eventarc_utils_1 = require("./eventarc-utils");
const api_request_1 = require("../utils/api-request");
const utils = require("../utils");
const error_1 = require("../utils/error");
const EVENTARC_API = 'https://eventarcpublishing.googleapis.com/v1';
const FIREBASE_VERSION_HEADER = {
    'X-Firebase-Client': `fire-admin-node/${utils.getSdkVersion()}`,
};
const CHANNEL_NAME_REGEX = /^(projects\/([^/]+)\/)?locations\/([^/]+)\/channels\/([^/]+)$/;
const DEFAULT_CHANNEL_REGION = 'us-central1';
/**
 * Class that facilitates sending requests to the Eventarc backend API.
 *
 * @internal
 */
class EventarcApiClient {
    constructor(app, channel) {
        this.app = app;
        this.channel = channel;
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new eventarc_utils_1.FirebaseEventarcError('invalid-argument', 'First argument passed to Channel() must be a valid Eventarc service instance.');
        }
        this.httpClient = new api_request_1.AuthorizedHttpClient(app);
        this.resolvedChannelName = this.resolveChannelName(channel.name);
    }
    getProjectId() {
        if (this.projectId) {
            return Promise.resolve(this.projectId);
        }
        return utils.findProjectId(this.app)
            .then((projectId) => {
            if (!validator.isNonEmptyString(projectId)) {
                throw new eventarc_utils_1.FirebaseEventarcError('unknown-error', 'Failed to determine project ID. Initialize the '
                    + 'SDK with service account credentials or set project ID as an app option. '
                    + 'Alternatively, set the GOOGLE_CLOUD_PROJECT environment variable.');
            }
            this.projectId = projectId;
            return projectId;
        });
    }
    /**
     * Publishes provided events to this channel. If channel was created with `allowedEventsTypes` and event type
     * is not on that list, the event is ignored.
     *
     * The following CloudEvent fields are auto-populated if not set:
     *  * specversion - `1.0`
     *  * id - uuidv4()
     *  * source - populated with `process.env.EVENTARC_CLOUD_EVENT_SOURCE` and
     *             if not set an error is thrown.
     *
     * @param events - CloudEvent to publish to the channel.
     */
    async publish(events) {
        if (!Array.isArray(events)) {
            events = [events];
        }
        return this.publishToEventarcApi(await this.resolvedChannelName, events
            .filter(e => typeof this.channel.allowedEventTypes === 'undefined' ||
            this.channel.allowedEventTypes.includes(e.type))
            .map(eventarc_utils_1.toCloudEventProtoFormat));
    }
    async publishToEventarcApi(channel, events) {
        if (events.length === 0) {
            return;
        }
        const request = {
            method: 'POST',
            url: `${this.getEventarcHost()}/${channel}:publishEvents`,
            data: JSON.stringify({ events }),
        };
        return this.sendRequest(request);
    }
    sendRequest(request) {
        request.headers = FIREBASE_VERSION_HEADER;
        return this.httpClient.send(request)
            .then(() => undefined)
            .catch((err) => {
            throw this.toFirebaseError(err);
        });
    }
    toFirebaseError(err) {
        if (err instanceof error_1.PrefixedFirebaseError) {
            return err;
        }
        const response = err.response;
        return new eventarc_utils_1.FirebaseEventarcError('unknown-error', `Unexpected response with status: ${response.status} and body: ${response.text}`);
    }
    resolveChannelName(name) {
        if (!name.includes('/')) {
            const location = DEFAULT_CHANNEL_REGION;
            const channelId = name;
            return this.resolveChannelNameProjectId(location, channelId);
        }
        else {
            const match = CHANNEL_NAME_REGEX.exec(name);
            if (match === null || match.length < 4) {
                throw new eventarc_utils_1.FirebaseEventarcError('invalid-argument', 'Invalid channel name format.');
            }
            const projectId = match[2];
            const location = match[3];
            const channelId = match[4];
            if (validator.isNonEmptyString(projectId)) {
                return Promise.resolve(`projects/${projectId}/locations/${location}/channels/${channelId}`);
            }
            else {
                return this.resolveChannelNameProjectId(location, channelId);
            }
        }
    }
    async resolveChannelNameProjectId(location, channelId) {
        const projectId = await this.getProjectId();
        return `projects/${projectId}/locations/${location}/channels/${channelId}`;
    }
    getEventarcHost() {
        return process.env.CLOUD_EVENTARC_EMULATOR_HOST ?? EVENTARC_API;
    }
}
exports.EventarcApiClient = EventarcApiClient;
