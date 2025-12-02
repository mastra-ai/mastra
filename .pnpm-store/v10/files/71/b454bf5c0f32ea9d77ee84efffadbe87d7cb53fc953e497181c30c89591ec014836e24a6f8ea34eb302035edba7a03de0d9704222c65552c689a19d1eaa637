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
exports.embedFileDesc = embedFileDesc;
exports.pathInFileDesc = pathInFileDesc;
exports.createFileDescriptorProtoBoot = createFileDescriptorProtoBoot;
const names_js_1 = require("../reflect/names.js");
const fields_js_1 = require("../fields.js");
const base64_encoding_js_1 = require("../wire/base64-encoding.js");
const to_binary_js_1 = require("../to-binary.js");
const clone_js_1 = require("../clone.js");
const descriptor_pb_js_1 = require("../wkt/gen/google/protobuf/descriptor_pb.js");
/**
 * Create necessary information to embed a file descriptor in
 * generated code.
 *
 * @private
 */
function embedFileDesc(file) {
    const embed = {
        bootable: false,
        proto() {
            const stripped = (0, clone_js_1.clone)(descriptor_pb_js_1.FileDescriptorProtoSchema, file);
            (0, fields_js_1.clearField)(stripped, descriptor_pb_js_1.FileDescriptorProtoSchema.field.dependency);
            (0, fields_js_1.clearField)(stripped, descriptor_pb_js_1.FileDescriptorProtoSchema.field.sourceCodeInfo);
            stripped.messageType.map(stripJsonNames);
            return stripped;
        },
        base64() {
            const bytes = (0, to_binary_js_1.toBinary)(descriptor_pb_js_1.FileDescriptorProtoSchema, this.proto());
            return (0, base64_encoding_js_1.base64Encode)(bytes, "std_raw");
        },
    };
    return file.name == "google/protobuf/descriptor.proto"
        ? Object.assign(Object.assign({}, embed), { bootable: true, boot() {
                return createFileDescriptorProtoBoot(this.proto());
            } }) : embed;
}
function stripJsonNames(d) {
    for (const f of d.field) {
        if (f.jsonName === (0, names_js_1.protoCamelCase)(f.name)) {
            (0, fields_js_1.clearField)(f, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.jsonName);
        }
    }
    for (const n of d.nestedType) {
        stripJsonNames(n);
    }
}
/**
 * Compute the path to a message, enumeration, extension, or service in a
 * file descriptor.
 *
 * @private
 */
function pathInFileDesc(desc) {
    if (desc.kind == "service") {
        return [desc.file.services.indexOf(desc)];
    }
    const parent = desc.parent;
    if (parent == undefined) {
        switch (desc.kind) {
            case "enum":
                return [desc.file.enums.indexOf(desc)];
            case "message":
                return [desc.file.messages.indexOf(desc)];
            case "extension":
                return [desc.file.extensions.indexOf(desc)];
        }
    }
    function findPath(cur) {
        const nested = [];
        for (let parent = cur.parent; parent;) {
            const idx = parent.nestedMessages.indexOf(cur);
            nested.unshift(idx);
            cur = parent;
            parent = cur.parent;
        }
        nested.unshift(cur.file.messages.indexOf(cur));
        return nested;
    }
    const path = findPath(parent);
    switch (desc.kind) {
        case "extension":
            return [...path, parent.nestedExtensions.indexOf(desc)];
        case "message":
            return [...path, parent.nestedMessages.indexOf(desc)];
        case "enum":
            return [...path, parent.nestedEnums.indexOf(desc)];
    }
}
/**
 * The file descriptor for google/protobuf/descriptor.proto cannot be embedded
 * in serialized form, since it is required to parse itself.
 *
 * This function takes an instance of the message, and returns a plain object
 * that can be hydrated to the message again via bootFileDescriptorProto().
 *
 * This function only works with a message google.protobuf.FileDescriptorProto
 * for google/protobuf/descriptor.proto, and only supports features that are
 * relevant for the specific use case. For example, it discards file options,
 * reserved ranges and reserved names, and field options that are unused in
 * descriptor.proto.
 *
 * @private
 */
function createFileDescriptorProtoBoot(proto) {
    var _a;
    assert(proto.name == "google/protobuf/descriptor.proto");
    assert(proto.package == "google.protobuf");
    assert(!proto.dependency.length);
    assert(!proto.publicDependency.length);
    assert(!proto.weakDependency.length);
    assert(!proto.optionDependency.length);
    assert(!proto.service.length);
    assert(!proto.extension.length);
    assert(proto.sourceCodeInfo === undefined);
    assert(proto.syntax == "" || proto.syntax == "proto2");
    assert(!((_a = proto.options) === null || _a === void 0 ? void 0 : _a.features)); // we're dropping file options
    assert(proto.edition === descriptor_pb_js_1.Edition.EDITION_UNKNOWN);
    return {
        name: proto.name,
        package: proto.package,
        messageType: proto.messageType.map(createDescriptorBoot),
        enumType: proto.enumType.map(createEnumDescriptorBoot),
    };
}
function createDescriptorBoot(proto) {
    assert(proto.extension.length == 0);
    assert(!proto.oneofDecl.length);
    assert(!proto.options);
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.DescriptorProtoSchema.field.visibility));
    const b = {
        name: proto.name,
    };
    if (proto.field.length) {
        b.field = proto.field.map(createFieldDescriptorBoot);
    }
    if (proto.nestedType.length) {
        b.nestedType = proto.nestedType.map(createDescriptorBoot);
    }
    if (proto.enumType.length) {
        b.enumType = proto.enumType.map(createEnumDescriptorBoot);
    }
    if (proto.extensionRange.length) {
        b.extensionRange = proto.extensionRange.map((r) => {
            assert(!r.options);
            return { start: r.start, end: r.end };
        });
    }
    return b;
}
function createFieldDescriptorBoot(proto) {
    assert((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.name));
    assert((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.number));
    assert((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.type));
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.oneofIndex));
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.jsonName) ||
        proto.jsonName === (0, names_js_1.protoCamelCase)(proto.name));
    const b = {
        name: proto.name,
        number: proto.number,
        type: proto.type,
    };
    if ((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.label)) {
        b.label = proto.label;
    }
    if ((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.typeName)) {
        b.typeName = proto.typeName;
    }
    if ((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.extendee)) {
        b.extendee = proto.extendee;
    }
    if ((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldDescriptorProtoSchema.field.defaultValue)) {
        b.defaultValue = proto.defaultValue;
    }
    if (proto.options) {
        b.options = createFieldOptionsBoot(proto.options);
    }
    return b;
}
function createFieldOptionsBoot(proto) {
    const b = {};
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.ctype));
    if ((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.packed)) {
        b.packed = proto.packed;
    }
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.jstype));
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.lazy));
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.unverifiedLazy));
    if ((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.deprecated)) {
        b.deprecated = proto.deprecated;
    }
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.weak));
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.debugRedact));
    if ((0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.retention)) {
        b.retention = proto.retention;
    }
    if (proto.targets.length) {
        b.targets = proto.targets;
    }
    if (proto.editionDefaults.length) {
        b.editionDefaults = proto.editionDefaults.map((d) => ({
            value: d.value,
            edition: d.edition,
        }));
    }
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.features));
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.FieldOptionsSchema.field.uninterpretedOption));
    return b;
}
function createEnumDescriptorBoot(proto) {
    assert(!proto.options);
    assert(!(0, fields_js_1.isFieldSet)(proto, descriptor_pb_js_1.EnumDescriptorProtoSchema.field.visibility));
    return {
        name: proto.name,
        value: proto.value.map((v) => {
            assert(!v.options);
            return {
                name: v.name,
                number: v.number,
            };
        }),
    };
}
/**
 * Assert that condition is truthy or throw error.
 */
function assert(condition) {
    if (!condition) {
        throw new Error();
    }
}
