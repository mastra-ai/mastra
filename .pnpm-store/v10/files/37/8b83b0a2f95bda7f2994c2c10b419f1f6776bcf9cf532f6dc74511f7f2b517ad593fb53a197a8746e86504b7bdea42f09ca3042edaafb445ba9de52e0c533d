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
import { DocumentData } from '@google-cloud/firestore';
import * as proto from '../protos/firestore_v1_proto_api';
import { Firestore } from './index';
import { FieldPath } from './path';
import { ApiMapValue, ValidationOptions } from './types';
import api = proto.google.firestore.v1;
/**
 * An interface for Firestore types that can be serialized to Protobuf.
 *
 * @private
 * @internal
 */
export interface Serializable {
    toProto(): api.IValue;
}
/**
 * Serializer that is used to convert between JavaScript types and their
 * Firestore Protobuf representation.
 *
 * @private
 * @internal
 */
export declare class Serializer {
    private allowUndefined;
    private createReference;
    private createInteger;
    constructor(firestore: Firestore);
    /**
     * Encodes a JavaScript object into the Firestore 'Fields' representation.
     *
     * @private
     * @internal
     * @param obj The object to encode.
     * @returns The Firestore 'Fields' representation
     */
    encodeFields(obj: DocumentData): ApiMapValue;
    /**
     * Encodes a JavaScript value into the Firestore 'Value' representation.
     *
     * @private
     * @internal
     * @param val The object to encode
     * @returns The Firestore Proto or null if we are deleting a field.
     */
    encodeValue(val: unknown): api.IValue | null;
    /**
     * @private
     */
    encodeVector(rawVector: number[]): api.IValue;
    /**
     * Decodes a single Firestore 'Value' Protobuf.
     *
     * @private
     * @internal
     * @param proto A Firestore 'Value' Protobuf.
     * @returns The converted JS type.
     */
    decodeValue(proto: api.IValue): unknown;
    /**
     * Decodes a google.protobuf.Value
     *
     * @private
     * @internal
     * @param proto A Google Protobuf 'Value'.
     * @returns The converted JS type.
     */
    decodeGoogleProtobufValue(proto: proto.google.protobuf.IValue): unknown;
    /**
     * Decodes a google.protobuf.ListValue
     *
     * @private
     * @internal
     * @param proto A Google Protobuf 'ListValue'.
     * @returns The converted JS type.
     */
    decodeGoogleProtobufList(proto: proto.google.protobuf.IListValue | null | undefined): unknown[];
    /**
     * Decodes a google.protobuf.Struct
     *
     * @private
     * @internal
     * @param proto A Google Protobuf 'Struct'.
     * @returns The converted JS type.
     */
    decodeGoogleProtobufStruct(proto: proto.google.protobuf.IStruct | null | undefined): Record<string, unknown>;
}
/**
 * Validates a JavaScript value for usage as a Firestore value.
 *
 * @private
 * @internal
 * @param arg The argument name or argument index (for varargs methods).
 * @param value JavaScript value to validate.
 * @param desc A description of the expected type.
 * @param path The field path to validate.
 * @param options Validation options
 * @param level The current depth of the traversal. This is used to decide
 * whether undefined values or deletes are allowed.
 * @param inArray Whether we are inside an array.
 * @throws when the object is invalid.
 */
export declare function validateUserInput(arg: string | number, value: unknown, desc: string, options: ValidationOptions, path?: FieldPath, level?: number, inArray?: boolean): void;
