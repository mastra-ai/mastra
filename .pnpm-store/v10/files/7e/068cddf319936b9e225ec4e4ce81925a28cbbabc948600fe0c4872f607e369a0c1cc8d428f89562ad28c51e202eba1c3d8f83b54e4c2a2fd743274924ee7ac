/*!
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as firestore from '@google-cloud/firestore';
import { google } from '../protos/firestore_v1_proto_api';
import { Serializable } from './serializer';
import api = google.firestore.v1;
/**
 * An immutable object representing a geographic location in Firestore. The
 * location is represented as a latitude/longitude pair.
 *
 * @class
 */
export declare class GeoPoint implements Serializable, firestore.GeoPoint {
    private readonly _latitude;
    private readonly _longitude;
    /**
     * Creates a [GeoPoint]{@link GeoPoint}.
     *
     * @param {number} latitude The latitude as a number between -90 and 90.
     * @param {number} longitude The longitude as a number between -180 and 180.
     *
     * @example
     * ```
     * let data = {
     *   google: new Firestore.GeoPoint(37.422, 122.084)
     * };
     *
     * firestore.doc('col/doc').set(data).then(() => {
     *   console.log(`Location is ${data.google.latitude}, ` +
     *     `${data.google.longitude}`);
     * });
     * ```
     */
    constructor(latitude: number, longitude: number);
    /**
     * The latitude as a number between -90 and 90.
     *
     * @type {number}
     * @name GeoPoint#latitude
     * @readonly
     */
    get latitude(): number;
    /**
     * The longitude as a number between -180 and 180.
     *
     * @type {number}
     * @name GeoPoint#longitude
     * @readonly
     */
    get longitude(): number;
    /**
     * Returns true if this `GeoPoint` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `GeoPoint` is equal to the provided value.
     */
    isEqual(other: firestore.GeoPoint): boolean;
    /**
     * Converts the GeoPoint to a google.type.LatLng proto.
     * @private
     * @internal
     */
    toProto(): api.IValue;
    /**
     * Converts a google.type.LatLng proto to its GeoPoint representation.
     * @private
     * @internal
     */
    static fromProto(proto: google.type.ILatLng): GeoPoint;
}
