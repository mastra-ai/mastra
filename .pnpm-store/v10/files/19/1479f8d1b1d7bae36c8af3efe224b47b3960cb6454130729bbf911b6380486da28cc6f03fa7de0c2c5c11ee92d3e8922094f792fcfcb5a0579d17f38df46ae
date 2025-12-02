"use strict";
var __webpack_modules__ = {
    "../client": function(module) {
        module.exports = require("../client.js");
    },
    "../exports": function(module) {
        module.exports = require("../exports.js");
    },
    "../extensions/error-tracking": function(module) {
        module.exports = require("../extensions/error-tracking/index.js");
    },
    "../extensions/error-tracking/modifiers/context-lines.node": function(module) {
        module.exports = require("../extensions/error-tracking/modifiers/context-lines.node.js");
    },
    "../extensions/error-tracking/modifiers/module.node": function(module) {
        module.exports = require("../extensions/error-tracking/modifiers/module.node.js");
    },
    "@posthog/core": function(module) {
        module.exports = require("@posthog/core");
    }
};
var __webpack_module_cache__ = {};
function __webpack_require__(moduleId) {
    var cachedModule = __webpack_module_cache__[moduleId];
    if (void 0 !== cachedModule) return cachedModule.exports;
    var module = __webpack_module_cache__[moduleId] = {
        exports: {}
    };
    __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    return module.exports;
}
(()=>{
    __webpack_require__.n = (module)=>{
        var getter = module && module.__esModule ? ()=>module['default'] : ()=>module;
        __webpack_require__.d(getter, {
            a: getter
        });
        return getter;
    };
})();
(()=>{
    __webpack_require__.d = (exports1, definition)=>{
        for(var key in definition)if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports1, key)) Object.defineProperty(exports1, key, {
            enumerable: true,
            get: definition[key]
        });
    };
})();
(()=>{
    __webpack_require__.o = (obj, prop)=>Object.prototype.hasOwnProperty.call(obj, prop);
})();
(()=>{
    __webpack_require__.r = (exports1)=>{
        if ('undefined' != typeof Symbol && Symbol.toStringTag) Object.defineProperty(exports1, Symbol.toStringTag, {
            value: 'Module'
        });
        Object.defineProperty(exports1, '__esModule', {
            value: true
        });
    };
})();
var __webpack_exports__ = {};
(()=>{
    __webpack_require__.r(__webpack_exports__);
    __webpack_require__.d(__webpack_exports__, {
        PostHog: ()=>PostHog
    });
    var _exports__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../exports");
    var __WEBPACK_REEXPORT_OBJECT__ = {};
    for(var __WEBPACK_IMPORT_KEY__ in _exports__WEBPACK_IMPORTED_MODULE_0__)if ([
        "default",
        "PostHog"
    ].indexOf(__WEBPACK_IMPORT_KEY__) < 0) __WEBPACK_REEXPORT_OBJECT__[__WEBPACK_IMPORT_KEY__] = (function(key) {
        return _exports__WEBPACK_IMPORTED_MODULE_0__[key];
    }).bind(0, __WEBPACK_IMPORT_KEY__);
    __webpack_require__.d(__webpack_exports__, __WEBPACK_REEXPORT_OBJECT__);
    var _extensions_error_tracking_modifiers_module_node__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../extensions/error-tracking/modifiers/module.node");
    var _extensions_error_tracking_modifiers_context_lines_node__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../extensions/error-tracking/modifiers/context-lines.node");
    var _extensions_error_tracking__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("../extensions/error-tracking");
    var _extensions_error_tracking__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/ __webpack_require__.n(_extensions_error_tracking__WEBPACK_IMPORTED_MODULE_3__);
    var _client__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__("../client");
    var _posthog_core__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__("@posthog/core");
    _extensions_error_tracking__WEBPACK_IMPORTED_MODULE_3___default().errorPropertiesBuilder = new _posthog_core__WEBPACK_IMPORTED_MODULE_5__.ErrorTracking.ErrorPropertiesBuilder([
        new _posthog_core__WEBPACK_IMPORTED_MODULE_5__.ErrorTracking.EventCoercer(),
        new _posthog_core__WEBPACK_IMPORTED_MODULE_5__.ErrorTracking.ErrorCoercer(),
        new _posthog_core__WEBPACK_IMPORTED_MODULE_5__.ErrorTracking.ObjectCoercer(),
        new _posthog_core__WEBPACK_IMPORTED_MODULE_5__.ErrorTracking.StringCoercer(),
        new _posthog_core__WEBPACK_IMPORTED_MODULE_5__.ErrorTracking.PrimitiveCoercer()
    ], [
        _posthog_core__WEBPACK_IMPORTED_MODULE_5__.ErrorTracking.nodeStackLineParser
    ], [
        (0, _extensions_error_tracking_modifiers_module_node__WEBPACK_IMPORTED_MODULE_1__.createModulerModifier)(),
        _extensions_error_tracking_modifiers_context_lines_node__WEBPACK_IMPORTED_MODULE_2__.addSourceContext
    ]);
    class PostHog extends _client__WEBPACK_IMPORTED_MODULE_4__.PostHogBackendClient {
        getLibraryId() {
            return 'posthog-node';
        }
    }
})();
exports.PostHog = __webpack_exports__.PostHog;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "PostHog"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
