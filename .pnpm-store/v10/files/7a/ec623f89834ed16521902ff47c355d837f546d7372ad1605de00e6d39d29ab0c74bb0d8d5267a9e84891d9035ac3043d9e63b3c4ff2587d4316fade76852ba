/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
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
import { google } from '../protos/firestore_v1_proto_api';
import { ApiMapValue, ProtobufJsValue } from './types';
import api = google.firestore.v1;
/*!
 * @module firestore/convert
 * @private
 * @internal
 *
 * This module contains utility functions to convert
 * `firestore.v1.Documents` from Proto3 JSON to their equivalent
 * representation in Protobuf JS. Protobuf JS is the only encoding supported by
 * this client, and dependencies that use Proto3 JSON (such as the Google Cloud
 * Functions SDK) are supported through this conversion and its usage in
 * {@see Firestore#snapshot_}.
 */
/**
 * Converts an ISO 8601 or google.protobuf.Timestamp proto into Protobuf JS.
 *
 * @private
 * @internal
 * @param timestampValue The value to convert.
 * @param argumentName The argument name to use in the error message if the
 * conversion fails. If omitted, 'timestampValue' is used.
 * @return The value as expected by Protobuf JS or undefined if no input was
 * provided.
 */
export declare function timestampFromJson(timestampValue?: string | google.protobuf.ITimestamp, argumentName?: string): google.protobuf.ITimestamp | undefined;
/**
 * Detects 'valueType' from a Proto3 JSON `firestore.v1.Value` proto.
 *
 * @private
 * @internal
 * @param proto The `firestore.v1.Value` proto.
 * @return The string value for 'valueType'.
 */
export declare function detectValueType(proto: ProtobufJsValue): string;
/**
 * Detects the value kind from a Proto3 JSON `google.protobuf.Value` proto.
 *
 * @private
 * @internal
 * @param proto The `firestore.v1.Value` proto.
 * @return The string value for 'valueType'.
 */
export declare function detectGoogleProtobufValueType(proto: google.protobuf.IValue): string;
/**
 * Converts a `firestore.v1.Value` in Proto3 JSON encoding into the
 * Protobuf JS format expected by this client.
 *
 * @private
 * @internal
 * @param fieldValue The `firestore.v1.Value` in Proto3 JSON format.
 * @return The `firestore.v1.Value` in Protobuf JS format.
 */
export declare function valueFromJson(fieldValue: api.IValue): api.IValue;
/**
 * Converts a map of IValues in Proto3 JSON encoding into the Protobuf JS format
 * expected by this client. This conversion creates a copy of the underlying
 * fields.
 *
 * @private
 * @internal
 * @param document An object with IValues in Proto3 JSON format.
 * @return The object in Protobuf JS format.
 */
export declare function fieldsFromJson(document: ApiMapValue): ApiMapValue;
