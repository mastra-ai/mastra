"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: Copyright The LanceDB Authors
Object.defineProperty(exports, "__esModule", { value: true });
exports.packBits = exports.rerankers = exports.PermutationBuilder = exports.permutationBuilder = exports.embedding = exports.MergeInsertBuilder = exports.OAuthHeaderProvider = exports.StaticHeaderProvider = exports.HeaderProvider = exports.Table = exports.Index = exports.Occur = exports.Operator = exports.FullTextQueryType = exports.BooleanQuery = exports.MultiMatchQuery = exports.BoostQuery = exports.PhraseQuery = exports.MatchQuery = exports.RecordBatchIterator = exports.TakeQuery = exports.VectorQuery = exports.QueryBase = exports.Query = exports.Session = exports.Connection = exports.VectorColumnOptions = exports.MakeArrowTableOptions = exports.makeArrowTable = exports.TagContents = exports.Tags = exports.NativeJsHeaderProvider = void 0;
exports.connect = connect;
const connection_1 = require("./connection");
const native_js_1 = require("./native.js");
// Re-export native header provider for use with connectWithHeaderProvider
var native_js_2 = require("./native.js");
Object.defineProperty(exports, "NativeJsHeaderProvider", { enumerable: true, get: function () { return native_js_2.JsHeaderProvider; } });
var native_js_3 = require("./native.js");
Object.defineProperty(exports, "Tags", { enumerable: true, get: function () { return native_js_3.Tags; } });
Object.defineProperty(exports, "TagContents", { enumerable: true, get: function () { return native_js_3.TagContents; } });
var arrow_1 = require("./arrow");
Object.defineProperty(exports, "makeArrowTable", { enumerable: true, get: function () { return arrow_1.makeArrowTable; } });
Object.defineProperty(exports, "MakeArrowTableOptions", { enumerable: true, get: function () { return arrow_1.MakeArrowTableOptions; } });
Object.defineProperty(exports, "VectorColumnOptions", { enumerable: true, get: function () { return arrow_1.VectorColumnOptions; } });
var connection_2 = require("./connection");
Object.defineProperty(exports, "Connection", { enumerable: true, get: function () { return connection_2.Connection; } });
var native_js_4 = require("./native.js");
Object.defineProperty(exports, "Session", { enumerable: true, get: function () { return native_js_4.Session; } });
var query_1 = require("./query");
Object.defineProperty(exports, "Query", { enumerable: true, get: function () { return query_1.Query; } });
Object.defineProperty(exports, "QueryBase", { enumerable: true, get: function () { return query_1.QueryBase; } });
Object.defineProperty(exports, "VectorQuery", { enumerable: true, get: function () { return query_1.VectorQuery; } });
Object.defineProperty(exports, "TakeQuery", { enumerable: true, get: function () { return query_1.TakeQuery; } });
Object.defineProperty(exports, "RecordBatchIterator", { enumerable: true, get: function () { return query_1.RecordBatchIterator; } });
Object.defineProperty(exports, "MatchQuery", { enumerable: true, get: function () { return query_1.MatchQuery; } });
Object.defineProperty(exports, "PhraseQuery", { enumerable: true, get: function () { return query_1.PhraseQuery; } });
Object.defineProperty(exports, "BoostQuery", { enumerable: true, get: function () { return query_1.BoostQuery; } });
Object.defineProperty(exports, "MultiMatchQuery", { enumerable: true, get: function () { return query_1.MultiMatchQuery; } });
Object.defineProperty(exports, "BooleanQuery", { enumerable: true, get: function () { return query_1.BooleanQuery; } });
Object.defineProperty(exports, "FullTextQueryType", { enumerable: true, get: function () { return query_1.FullTextQueryType; } });
Object.defineProperty(exports, "Operator", { enumerable: true, get: function () { return query_1.Operator; } });
Object.defineProperty(exports, "Occur", { enumerable: true, get: function () { return query_1.Occur; } });
var indices_1 = require("./indices");
Object.defineProperty(exports, "Index", { enumerable: true, get: function () { return indices_1.Index; } });
var table_1 = require("./table");
Object.defineProperty(exports, "Table", { enumerable: true, get: function () { return table_1.Table; } });
var header_1 = require("./header");
Object.defineProperty(exports, "HeaderProvider", { enumerable: true, get: function () { return header_1.HeaderProvider; } });
Object.defineProperty(exports, "StaticHeaderProvider", { enumerable: true, get: function () { return header_1.StaticHeaderProvider; } });
Object.defineProperty(exports, "OAuthHeaderProvider", { enumerable: true, get: function () { return header_1.OAuthHeaderProvider; } });
var merge_1 = require("./merge");
Object.defineProperty(exports, "MergeInsertBuilder", { enumerable: true, get: function () { return merge_1.MergeInsertBuilder; } });
exports.embedding = require("./embedding");
var permutation_1 = require("./permutation");
Object.defineProperty(exports, "permutationBuilder", { enumerable: true, get: function () { return permutation_1.permutationBuilder; } });
Object.defineProperty(exports, "PermutationBuilder", { enumerable: true, get: function () { return permutation_1.PermutationBuilder; } });
exports.rerankers = require("./rerankers");
var util_1 = require("./util");
Object.defineProperty(exports, "packBits", { enumerable: true, get: function () { return util_1.packBits; } });
async function connect(uriOrOptions, optionsOrSession, sessionOrHeaderProvider, headerProvider) {
    let uri;
    let finalOptions = {};
    let finalHeaderProvider;
    if (typeof uriOrOptions !== "string") {
        // First overload: connect(options)
        const { uri: uri_, ...opts } = uriOrOptions;
        uri = uri_;
        finalOptions = opts;
    }
    else {
        // Second overload: connect(uri, options?, session?, headerProvider?)
        uri = uriOrOptions;
        // Handle optionsOrSession parameter
        if (optionsOrSession && "inner" in optionsOrSession) {
            // Second param is session, so no options provided
            finalOptions = {};
        }
        else {
            // Second param is options
            finalOptions = optionsOrSession || {};
        }
        // Handle sessionOrHeaderProvider parameter
        if (sessionOrHeaderProvider &&
            (typeof sessionOrHeaderProvider === "function" ||
                "getHeaders" in sessionOrHeaderProvider)) {
            // Third param is header provider
            finalHeaderProvider = sessionOrHeaderProvider;
        }
        else {
            // Third param is session, header provider is fourth param
            finalHeaderProvider = headerProvider;
        }
    }
    if (!uri) {
        throw new Error("uri is required");
    }
    finalOptions = finalOptions ?? {};
    finalOptions.storageOptions = (0, connection_1.cleanseStorageOptions)(finalOptions.storageOptions);
    // Create native header provider if one was provided
    let nativeProvider;
    if (finalHeaderProvider) {
        if (typeof finalHeaderProvider === "function") {
            nativeProvider = new native_js_1.JsHeaderProvider(finalHeaderProvider);
        }
        else if (finalHeaderProvider &&
            typeof finalHeaderProvider.getHeaders === "function") {
            nativeProvider = new native_js_1.JsHeaderProvider(async () => finalHeaderProvider.getHeaders());
        }
    }
    const nativeConn = await native_js_1.Connection.new(uri, finalOptions, nativeProvider);
    return new connection_1.LocalConnection(nativeConn);
}
