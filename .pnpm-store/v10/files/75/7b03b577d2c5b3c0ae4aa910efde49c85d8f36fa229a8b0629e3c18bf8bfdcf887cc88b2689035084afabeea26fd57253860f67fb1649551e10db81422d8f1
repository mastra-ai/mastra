"use strict";
var __webpack_require__ = {};
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
    extractSafariExtensionDetails: ()=>extractSafariExtensionDetails
});
const external_base_js_namespaceObject = require("./base.js");
const extractSafariExtensionDetails = (func, filename)=>{
    const isSafariExtension = -1 !== func.indexOf('safari-extension');
    const isSafariWebExtension = -1 !== func.indexOf('safari-web-extension');
    return isSafariExtension || isSafariWebExtension ? [
        -1 !== func.indexOf('@') ? func.split('@')[0] : external_base_js_namespaceObject.UNKNOWN_FUNCTION,
        isSafariExtension ? `safari-extension:${filename}` : `safari-web-extension:${filename}`
    ] : [
        func,
        filename
    ];
};
exports.extractSafariExtensionDetails = __webpack_exports__.extractSafariExtensionDetails;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "extractSafariExtensionDetails"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
