"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeoPoint = void 0;
const validate_1 = require("./validate");
/**
 * An immutable object representing a geographic location in Firestore. The
 * location is represented as a latitude/longitude pair.
 *
 * @class
 */
class GeoPoint {
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
    constructor(latitude, longitude) {
        (0, validate_1.validateNumber)('latitude', latitude, { minValue: -90, maxValue: 90 });
        (0, validate_1.validateNumber)('longitude', longitude, { minValue: -180, maxValue: 180 });
        this._latitude = latitude;
        this._longitude = longitude;
    }
    /**
     * The latitude as a number between -90 and 90.
     *
     * @type {number}
     * @name GeoPoint#latitude
     * @readonly
     */
    get latitude() {
        return this._latitude;
    }
    /**
     * The longitude as a number between -180 and 180.
     *
     * @type {number}
     * @name GeoPoint#longitude
     * @readonly
     */
    get longitude() {
        return this._longitude;
    }
    /**
     * Returns true if this `GeoPoint` is equal to the provided value.
     *
     * @param {*} other The value to compare against.
     * @return {boolean} true if this `GeoPoint` is equal to the provided value.
     */
    isEqual(other) {
        return (this === other ||
            (other instanceof GeoPoint &&
                this.latitude === other.latitude &&
                this.longitude === other.longitude));
    }
    /**
     * Converts the GeoPoint to a google.type.LatLng proto.
     * @private
     * @internal
     */
    toProto() {
        return {
            geoPointValue: {
                latitude: this.latitude,
                longitude: this.longitude,
            },
        };
    }
    /**
     * Converts a google.type.LatLng proto to its GeoPoint representation.
     * @private
     * @internal
     */
    static fromProto(proto) {
        return new GeoPoint(proto.latitude || 0, proto.longitude || 0);
    }
}
exports.GeoPoint = GeoPoint;
//# sourceMappingURL=geo-point.js.map