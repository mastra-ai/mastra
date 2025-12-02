"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingsList = void 0;
/* This class wraps the OpenAPI-generated EmbeddingsList interface so that an EmbeddingsList object acts like an Array.
This class also customizes the output of an EmbeddingsList to improve UX.

```typescript
const embeddingsList = new EmbeddingsList('someEmbeddingModel', [embedding1, embedding2], usage);
console.log(embeddingsList);
>>> EmbeddingsList({
  "model": "someEmbeddingModel",
  "data": [
    "values": [0.1, 0.2, ..., 0.5, 0.6],
    "values": [0.6, 0.7, ..., 1.0, 1.1]
  ],
  "usage": {"totalTokens": 2}
})
```
*/
var EmbeddingsList = /** @class */ (function (_super) {
    __extends(EmbeddingsList, _super);
    function EmbeddingsList(model, data, usage) {
        if (data === void 0) { data = []; }
        var _this = _super.apply(this, data) || this;
        // Set the prototype explicitly to ensure the instance is of type EmbeddingsList
        Object.setPrototypeOf(_this, EmbeddingsList.prototype);
        _this.model = model;
        _this.data = data;
        _this.usage = usage;
        return _this;
    }
    /* Customize format of output. */
    EmbeddingsList.prototype.toString = function () {
        var truncatedData = this.truncateDataForDisplay();
        var dataObject = truncatedData
            .map(function (embedding) {
            var _a;
            if (typeof embedding === 'string') {
                return "    ".concat(embedding);
            }
            var embeddingObject = JSON.stringify(embedding, function (key, value) {
                return key === 'values' && Array.isArray(value) ? value : value;
            });
            embeddingObject = embeddingObject.replace(/:/g, ': ');
            // Format the embedding itself
            var valuesArray = ((_a = embeddingObject.match(/"values": \[(.*?)\]/)) === null || _a === void 0 ? void 0 : _a[1]) || '';
            var formattedEmbedding = valuesArray
                .split(',')
                .join(', ')
                .replace(/"/g, '');
            // Replace the right side of the colon after "values: "
            embeddingObject = embeddingObject.replace(/("values": )\[(.*?)\]/, "$1[".concat(formattedEmbedding, "]"));
            return "    ".concat(embeddingObject);
        })
            .join(',\n');
        var usageObject = JSON.stringify(this.usage).replace(/:/g, ': ');
        return ("EmbeddingsList({\n" +
            "  \"model\": \"".concat(this.model, "\",\n") +
            "  \"data\": [\n" +
            "".concat(dataObject, "\n") +
            "   ],\n" +
            "  \"usage\": ".concat(usageObject, "\n") +
            "  })");
    };
    EmbeddingsList.prototype.toJSON = function () {
        return {
            model: this.model,
            data: this.truncateDataForDisplay(),
            usage: this.usage,
        };
    };
    EmbeddingsList.prototype.get = function (index) {
        return this[index];
    };
    EmbeddingsList.prototype.indexOf = function (element) {
        return this.data ? this.data.indexOf(element) : -1;
    };
    /* Truncate the content of an embedding in the output when there are >5 numbers. */
    EmbeddingsList.prototype.truncateValuesForDisplay = function (values) {
        if (!values || values.length <= 4) {
            return values ? values : [];
        }
        return __spreadArray(__spreadArray(__spreadArray([], values.slice(0, 2), true), ['...'], false), values.slice(-2), true);
    };
    /* Truncate the number of embedding objects in the output when there are more >6 embeddings. */
    EmbeddingsList.prototype.truncateDataForDisplay = function () {
        var _this = this;
        if (!this.data)
            return [];
        if (this.data.length <= 5) {
            return this.data.map(function (embedding) { return ({
                values: embedding.values
                    ? _this.truncateValuesForDisplay(embedding.values)
                    : [],
            }); });
        }
        return __spreadArray(__spreadArray(__spreadArray([], this.data.slice(0, 2).map(function (embedding) { return ({
            values: embedding.values
                ? _this.truncateValuesForDisplay(embedding.values)
                : [],
        }); }), true), [
            "   ... (".concat(this.data.length - 4, " more embeddings) ...")
        ], false), this.data.slice(-2).map(function (embedding) { return ({
            values: embedding.values
                ? _this.truncateValuesForDisplay(embedding.values)
                : [],
        }); }), true);
    };
    return EmbeddingsList;
}(Array));
exports.EmbeddingsList = EmbeddingsList;
//# sourceMappingURL=embeddingsList.js.map