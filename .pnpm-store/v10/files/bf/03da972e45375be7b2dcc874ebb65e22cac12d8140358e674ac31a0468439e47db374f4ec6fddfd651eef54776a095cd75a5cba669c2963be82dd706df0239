"use strict";
// Copyright 2021-2025 Buf Technologies, Inc.
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
exports.SyntaxSchema = exports.Syntax = exports.OptionSchema = exports.EnumValueSchema = exports.EnumSchema = exports.Field_CardinalitySchema = exports.Field_Cardinality = exports.Field_KindSchema = exports.Field_Kind = exports.FieldSchema = exports.TypeSchema = exports.file_google_protobuf_type = void 0;
const file_js_1 = require("../../../../codegenv2/file.js");
const any_pb_js_1 = require("./any_pb.js");
const source_context_pb_js_1 = require("./source_context_pb.js");
const message_js_1 = require("../../../../codegenv2/message.js");
const enum_js_1 = require("../../../../codegenv2/enum.js");
/**
 * Describes the file google/protobuf/type.proto.
 */
exports.file_google_protobuf_type = (0, file_js_1.fileDesc)("Chpnb29nbGUvcHJvdG9idWYvdHlwZS5wcm90bxIPZ29vZ2xlLnByb3RvYnVmIugBCgRUeXBlEgwKBG5hbWUYASABKAkSJgoGZmllbGRzGAIgAygLMhYuZ29vZ2xlLnByb3RvYnVmLkZpZWxkEg4KBm9uZW9mcxgDIAMoCRIoCgdvcHRpb25zGAQgAygLMhcuZ29vZ2xlLnByb3RvYnVmLk9wdGlvbhI2Cg5zb3VyY2VfY29udGV4dBgFIAEoCzIeLmdvb2dsZS5wcm90b2J1Zi5Tb3VyY2VDb250ZXh0EicKBnN5bnRheBgGIAEoDjIXLmdvb2dsZS5wcm90b2J1Zi5TeW50YXgSDwoHZWRpdGlvbhgHIAEoCSLVBQoFRmllbGQSKQoEa2luZBgBIAEoDjIbLmdvb2dsZS5wcm90b2J1Zi5GaWVsZC5LaW5kEjcKC2NhcmRpbmFsaXR5GAIgASgOMiIuZ29vZ2xlLnByb3RvYnVmLkZpZWxkLkNhcmRpbmFsaXR5Eg4KBm51bWJlchgDIAEoBRIMCgRuYW1lGAQgASgJEhAKCHR5cGVfdXJsGAYgASgJEhMKC29uZW9mX2luZGV4GAcgASgFEg4KBnBhY2tlZBgIIAEoCBIoCgdvcHRpb25zGAkgAygLMhcuZ29vZ2xlLnByb3RvYnVmLk9wdGlvbhIRCglqc29uX25hbWUYCiABKAkSFQoNZGVmYXVsdF92YWx1ZRgLIAEoCSLIAgoES2luZBIQCgxUWVBFX1VOS05PV04QABIPCgtUWVBFX0RPVUJMRRABEg4KClRZUEVfRkxPQVQQAhIOCgpUWVBFX0lOVDY0EAMSDwoLVFlQRV9VSU5UNjQQBBIOCgpUWVBFX0lOVDMyEAUSEAoMVFlQRV9GSVhFRDY0EAYSEAoMVFlQRV9GSVhFRDMyEAcSDQoJVFlQRV9CT09MEAgSDwoLVFlQRV9TVFJJTkcQCRIOCgpUWVBFX0dST1VQEAoSEAoMVFlQRV9NRVNTQUdFEAsSDgoKVFlQRV9CWVRFUxAMEg8KC1RZUEVfVUlOVDMyEA0SDQoJVFlQRV9FTlVNEA4SEQoNVFlQRV9TRklYRUQzMhAPEhEKDVRZUEVfU0ZJWEVENjQQEBIPCgtUWVBFX1NJTlQzMhAREg8KC1RZUEVfU0lOVDY0EBIidAoLQ2FyZGluYWxpdHkSFwoTQ0FSRElOQUxJVFlfVU5LTk9XThAAEhgKFENBUkRJTkFMSVRZX09QVElPTkFMEAESGAoUQ0FSRElOQUxJVFlfUkVRVUlSRUQQAhIYChRDQVJESU5BTElUWV9SRVBFQVRFRBADIt8BCgRFbnVtEgwKBG5hbWUYASABKAkSLQoJZW51bXZhbHVlGAIgAygLMhouZ29vZ2xlLnByb3RvYnVmLkVudW1WYWx1ZRIoCgdvcHRpb25zGAMgAygLMhcuZ29vZ2xlLnByb3RvYnVmLk9wdGlvbhI2Cg5zb3VyY2VfY29udGV4dBgEIAEoCzIeLmdvb2dsZS5wcm90b2J1Zi5Tb3VyY2VDb250ZXh0EicKBnN5bnRheBgFIAEoDjIXLmdvb2dsZS5wcm90b2J1Zi5TeW50YXgSDwoHZWRpdGlvbhgGIAEoCSJTCglFbnVtVmFsdWUSDAoEbmFtZRgBIAEoCRIOCgZudW1iZXIYAiABKAUSKAoHb3B0aW9ucxgDIAMoCzIXLmdvb2dsZS5wcm90b2J1Zi5PcHRpb24iOwoGT3B0aW9uEgwKBG5hbWUYASABKAkSIwoFdmFsdWUYAiABKAsyFC5nb29nbGUucHJvdG9idWYuQW55KkMKBlN5bnRheBIRCg1TWU5UQVhfUFJPVE8yEAASEQoNU1lOVEFYX1BST1RPMxABEhMKD1NZTlRBWF9FRElUSU9OUxACQnsKE2NvbS5nb29nbGUucHJvdG9idWZCCVR5cGVQcm90b1ABWi1nb29nbGUuZ29sYW5nLm9yZy9wcm90b2J1Zi90eXBlcy9rbm93bi90eXBlcGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMw", [any_pb_js_1.file_google_protobuf_any, source_context_pb_js_1.file_google_protobuf_source_context]);
/**
 * Describes the message google.protobuf.Type.
 * Use `create(TypeSchema)` to create a new message.
 */
exports.TypeSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 0);
/**
 * Describes the message google.protobuf.Field.
 * Use `create(FieldSchema)` to create a new message.
 */
exports.FieldSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 1);
/**
 * Basic field types.
 *
 * @generated from enum google.protobuf.Field.Kind
 */
var Field_Kind;
(function (Field_Kind) {
    /**
     * Field type unknown.
     *
     * @generated from enum value: TYPE_UNKNOWN = 0;
     */
    Field_Kind[Field_Kind["TYPE_UNKNOWN"] = 0] = "TYPE_UNKNOWN";
    /**
     * Field type double.
     *
     * @generated from enum value: TYPE_DOUBLE = 1;
     */
    Field_Kind[Field_Kind["TYPE_DOUBLE"] = 1] = "TYPE_DOUBLE";
    /**
     * Field type float.
     *
     * @generated from enum value: TYPE_FLOAT = 2;
     */
    Field_Kind[Field_Kind["TYPE_FLOAT"] = 2] = "TYPE_FLOAT";
    /**
     * Field type int64.
     *
     * @generated from enum value: TYPE_INT64 = 3;
     */
    Field_Kind[Field_Kind["TYPE_INT64"] = 3] = "TYPE_INT64";
    /**
     * Field type uint64.
     *
     * @generated from enum value: TYPE_UINT64 = 4;
     */
    Field_Kind[Field_Kind["TYPE_UINT64"] = 4] = "TYPE_UINT64";
    /**
     * Field type int32.
     *
     * @generated from enum value: TYPE_INT32 = 5;
     */
    Field_Kind[Field_Kind["TYPE_INT32"] = 5] = "TYPE_INT32";
    /**
     * Field type fixed64.
     *
     * @generated from enum value: TYPE_FIXED64 = 6;
     */
    Field_Kind[Field_Kind["TYPE_FIXED64"] = 6] = "TYPE_FIXED64";
    /**
     * Field type fixed32.
     *
     * @generated from enum value: TYPE_FIXED32 = 7;
     */
    Field_Kind[Field_Kind["TYPE_FIXED32"] = 7] = "TYPE_FIXED32";
    /**
     * Field type bool.
     *
     * @generated from enum value: TYPE_BOOL = 8;
     */
    Field_Kind[Field_Kind["TYPE_BOOL"] = 8] = "TYPE_BOOL";
    /**
     * Field type string.
     *
     * @generated from enum value: TYPE_STRING = 9;
     */
    Field_Kind[Field_Kind["TYPE_STRING"] = 9] = "TYPE_STRING";
    /**
     * Field type group. Proto2 syntax only, and deprecated.
     *
     * @generated from enum value: TYPE_GROUP = 10;
     */
    Field_Kind[Field_Kind["TYPE_GROUP"] = 10] = "TYPE_GROUP";
    /**
     * Field type message.
     *
     * @generated from enum value: TYPE_MESSAGE = 11;
     */
    Field_Kind[Field_Kind["TYPE_MESSAGE"] = 11] = "TYPE_MESSAGE";
    /**
     * Field type bytes.
     *
     * @generated from enum value: TYPE_BYTES = 12;
     */
    Field_Kind[Field_Kind["TYPE_BYTES"] = 12] = "TYPE_BYTES";
    /**
     * Field type uint32.
     *
     * @generated from enum value: TYPE_UINT32 = 13;
     */
    Field_Kind[Field_Kind["TYPE_UINT32"] = 13] = "TYPE_UINT32";
    /**
     * Field type enum.
     *
     * @generated from enum value: TYPE_ENUM = 14;
     */
    Field_Kind[Field_Kind["TYPE_ENUM"] = 14] = "TYPE_ENUM";
    /**
     * Field type sfixed32.
     *
     * @generated from enum value: TYPE_SFIXED32 = 15;
     */
    Field_Kind[Field_Kind["TYPE_SFIXED32"] = 15] = "TYPE_SFIXED32";
    /**
     * Field type sfixed64.
     *
     * @generated from enum value: TYPE_SFIXED64 = 16;
     */
    Field_Kind[Field_Kind["TYPE_SFIXED64"] = 16] = "TYPE_SFIXED64";
    /**
     * Field type sint32.
     *
     * @generated from enum value: TYPE_SINT32 = 17;
     */
    Field_Kind[Field_Kind["TYPE_SINT32"] = 17] = "TYPE_SINT32";
    /**
     * Field type sint64.
     *
     * @generated from enum value: TYPE_SINT64 = 18;
     */
    Field_Kind[Field_Kind["TYPE_SINT64"] = 18] = "TYPE_SINT64";
})(Field_Kind || (exports.Field_Kind = Field_Kind = {}));
/**
 * Describes the enum google.protobuf.Field.Kind.
 */
exports.Field_KindSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_type, 1, 0);
/**
 * Whether a field is optional, required, or repeated.
 *
 * @generated from enum google.protobuf.Field.Cardinality
 */
var Field_Cardinality;
(function (Field_Cardinality) {
    /**
     * For fields with unknown cardinality.
     *
     * @generated from enum value: CARDINALITY_UNKNOWN = 0;
     */
    Field_Cardinality[Field_Cardinality["UNKNOWN"] = 0] = "UNKNOWN";
    /**
     * For optional fields.
     *
     * @generated from enum value: CARDINALITY_OPTIONAL = 1;
     */
    Field_Cardinality[Field_Cardinality["OPTIONAL"] = 1] = "OPTIONAL";
    /**
     * For required fields. Proto2 syntax only.
     *
     * @generated from enum value: CARDINALITY_REQUIRED = 2;
     */
    Field_Cardinality[Field_Cardinality["REQUIRED"] = 2] = "REQUIRED";
    /**
     * For repeated fields.
     *
     * @generated from enum value: CARDINALITY_REPEATED = 3;
     */
    Field_Cardinality[Field_Cardinality["REPEATED"] = 3] = "REPEATED";
})(Field_Cardinality || (exports.Field_Cardinality = Field_Cardinality = {}));
/**
 * Describes the enum google.protobuf.Field.Cardinality.
 */
exports.Field_CardinalitySchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_type, 1, 1);
/**
 * Describes the message google.protobuf.Enum.
 * Use `create(EnumSchema)` to create a new message.
 */
exports.EnumSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 2);
/**
 * Describes the message google.protobuf.EnumValue.
 * Use `create(EnumValueSchema)` to create a new message.
 */
exports.EnumValueSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 3);
/**
 * Describes the message google.protobuf.Option.
 * Use `create(OptionSchema)` to create a new message.
 */
exports.OptionSchema = (0, message_js_1.messageDesc)(exports.file_google_protobuf_type, 4);
/**
 * The syntax in which a protocol buffer element is defined.
 *
 * @generated from enum google.protobuf.Syntax
 */
var Syntax;
(function (Syntax) {
    /**
     * Syntax `proto2`.
     *
     * @generated from enum value: SYNTAX_PROTO2 = 0;
     */
    Syntax[Syntax["PROTO2"] = 0] = "PROTO2";
    /**
     * Syntax `proto3`.
     *
     * @generated from enum value: SYNTAX_PROTO3 = 1;
     */
    Syntax[Syntax["PROTO3"] = 1] = "PROTO3";
    /**
     * Syntax `editions`.
     *
     * @generated from enum value: SYNTAX_EDITIONS = 2;
     */
    Syntax[Syntax["EDITIONS"] = 2] = "EDITIONS";
})(Syntax || (exports.Syntax = Syntax = {}));
/**
 * Describes the enum google.protobuf.Syntax.
 */
exports.SyntaxSchema = (0, enum_js_1.enumDesc)(exports.file_google_protobuf_type, 0);
