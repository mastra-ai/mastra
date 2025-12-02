"use strict";
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
var index_1 = require("./index");
var samples = 10;
var list = __spreadArray([], Array(samples), true);
console.info("\npoolSize()               // = ".concat((0, index_1.poolSize)().toLocaleString()));
console.info("minLength()              // = ".concat((0, index_1.minLength)().toLocaleString()));
console.info("maxLength()              // = ".concat((0, index_1.maxLength)().toLocaleString()));
console.info("\nhumanId()");
list.forEach(function (_) { return console.log("> ".concat((0, index_1.humanId)())); });
console.info("\nhumanId('-')             // or { \"separator\": \"-\" }");
list.forEach(function (_) { return console.log("> ".concat((0, index_1.humanId)('-'))); });
console.info("\nhumanId(false)           // or { \"capitalize\": false }");
list.forEach(function (_) { return console.log("> ".concat((0, index_1.humanId)(false))); });
var options = { adjectiveCount: 2, addAdverb: true, separator: '.' };
console.info("\nconst options = ".concat(JSON.stringify(options, null, ' ')));
console.info("poolSize(options)        // = ".concat((0, index_1.poolSize)(options).toLocaleString()));
console.info("minLength(options)       // = ".concat((0, index_1.minLength)(options).toLocaleString()));
console.info("maxLength(options)       // = ".concat((0, index_1.maxLength)(options).toLocaleString()));
console.info("humanId(options)");
list.forEach(function (_) { return console.log("> ".concat((0, index_1.humanId)(options))); });
//# sourceMappingURL=examples.js.map