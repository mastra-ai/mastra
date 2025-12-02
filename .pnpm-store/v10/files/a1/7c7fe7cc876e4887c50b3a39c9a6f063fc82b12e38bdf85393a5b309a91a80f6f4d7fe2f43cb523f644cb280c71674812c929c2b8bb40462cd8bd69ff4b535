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
exports.boot = boot;
exports.bootFileDescriptorProto = bootFileDescriptorProto;
const restore_json_names_js_1 = require("./restore-json-names.js");
const registry_js_1 = require("../registry.js");
/**
 * Hydrate a file descriptor for google/protobuf/descriptor.proto from a plain
 * object.
 *
 * See createFileDescriptorProtoBoot() for details.
 *
 * @private
 */
function boot(boot) {
    const root = bootFileDescriptorProto(boot);
    root.messageType.forEach(restore_json_names_js_1.restoreJsonNames);
    const reg = (0, registry_js_1.createFileRegistry)(root, () => undefined);
    // biome-ignore lint/style/noNonNullAssertion: non-null assertion because we just created the registry from the file we look up
    return reg.getFile(root.name);
}
/**
 * Creates the message google.protobuf.FileDescriptorProto from an object literal.
 *
 * See createFileDescriptorProtoBoot() for details.
 *
 * @private
 */
function bootFileDescriptorProto(init) {
    const proto = Object.create({
        syntax: "",
        edition: 0,
    });
    return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FileDescriptorProto", dependency: [], publicDependency: [], weakDependency: [], optionDependency: [], service: [], extension: [] }, init), { messageType: init.messageType.map(bootDescriptorProto), enumType: init.enumType.map(bootEnumDescriptorProto) }));
}
function bootDescriptorProto(init) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const proto = Object.create({
        visibility: 0,
    });
    return Object.assign(proto, {
        $typeName: "google.protobuf.DescriptorProto",
        name: init.name,
        field: (_b = (_a = init.field) === null || _a === void 0 ? void 0 : _a.map(bootFieldDescriptorProto)) !== null && _b !== void 0 ? _b : [],
        extension: [],
        nestedType: (_d = (_c = init.nestedType) === null || _c === void 0 ? void 0 : _c.map(bootDescriptorProto)) !== null && _d !== void 0 ? _d : [],
        enumType: (_f = (_e = init.enumType) === null || _e === void 0 ? void 0 : _e.map(bootEnumDescriptorProto)) !== null && _f !== void 0 ? _f : [],
        extensionRange: (_h = (_g = init.extensionRange) === null || _g === void 0 ? void 0 : _g.map((e) => (Object.assign({ $typeName: "google.protobuf.DescriptorProto.ExtensionRange" }, e)))) !== null && _h !== void 0 ? _h : [],
        oneofDecl: [],
        reservedRange: [],
        reservedName: [],
    });
}
function bootFieldDescriptorProto(init) {
    const proto = Object.create({
        label: 1,
        typeName: "",
        extendee: "",
        defaultValue: "",
        oneofIndex: 0,
        jsonName: "",
        proto3Optional: false,
    });
    return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FieldDescriptorProto" }, init), { options: init.options ? bootFieldOptions(init.options) : undefined }));
}
function bootFieldOptions(init) {
    var _a, _b, _c;
    const proto = Object.create({
        ctype: 0,
        packed: false,
        jstype: 0,
        lazy: false,
        unverifiedLazy: false,
        deprecated: false,
        weak: false,
        debugRedact: false,
        retention: 0,
    });
    return Object.assign(proto, Object.assign(Object.assign({ $typeName: "google.protobuf.FieldOptions" }, init), { targets: (_a = init.targets) !== null && _a !== void 0 ? _a : [], editionDefaults: (_c = (_b = init.editionDefaults) === null || _b === void 0 ? void 0 : _b.map((e) => (Object.assign({ $typeName: "google.protobuf.FieldOptions.EditionDefault" }, e)))) !== null && _c !== void 0 ? _c : [], uninterpretedOption: [] }));
}
function bootEnumDescriptorProto(init) {
    const proto = Object.create({
        visibility: 0,
    });
    return Object.assign(proto, {
        $typeName: "google.protobuf.EnumDescriptorProto",
        name: init.name,
        reservedName: [],
        reservedRange: [],
        value: init.value.map((e) => (Object.assign({ $typeName: "google.protobuf.EnumValueDescriptorProto" }, e))),
    });
}
