"use strict";
var __webpack_require__ = {};
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
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
    setupExpressErrorHandler: ()=>setupExpressErrorHandler
});
const core_namespaceObject = require("@posthog/core");
const index_js_namespaceObject = require("./error-tracking/index.js");
var index_js_default = /*#__PURE__*/ __webpack_require__.n(index_js_namespaceObject);
function setupExpressErrorHandler(_posthog, app) {
    app.use((error, _, __, next)=>{
        const hint = {
            mechanism: {
                type: 'middleware',
                handled: false
            }
        };
        index_js_default().buildEventMessage(error, hint, (0, core_namespaceObject.uuidv7)(), {
            $process_person_profile: false
        }).then((msg)=>_posthog.capture(msg));
        next(error);
    });
}
exports.setupExpressErrorHandler = __webpack_exports__.setupExpressErrorHandler;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "setupExpressErrorHandler"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
