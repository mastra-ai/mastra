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
    spawnLocal: ()=>spawnLocal
});
const external_cross_spawn_namespaceObject = require("cross-spawn");
async function spawnLocal(executable, args, options) {
    const child = (0, external_cross_spawn_namespaceObject.spawn)(executable, [
        ...args
    ], {
        stdio: options.stdio ?? 'inherit',
        env: options.env,
        cwd: options.cwd
    });
    await new Promise((resolve, reject)=>{
        child.on('close', (code)=>{
            if (0 === code) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
        child.on('error', (error)=>{
            reject(error);
        });
    });
}
exports.spawnLocal = __webpack_exports__.spawnLocal;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "spawnLocal"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
