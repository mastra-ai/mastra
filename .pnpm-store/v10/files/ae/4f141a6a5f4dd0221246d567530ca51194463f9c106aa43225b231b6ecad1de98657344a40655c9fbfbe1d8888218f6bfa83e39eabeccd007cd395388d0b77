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
    PostHogCoreTestClient: ()=>PostHogCoreTestClient,
    createTestClient: ()=>createTestClient
});
const external_posthog_core_js_namespaceObject = require("../posthog-core.js");
const version = '2.0.0-alpha';
class PostHogCoreTestClient extends external_posthog_core_js_namespaceObject.PostHogCore {
    constructor(mocks, apiKey, options){
        super(apiKey, options), this.mocks = mocks;
        this.setupBootstrap(options);
    }
    getFlags(distinctId, groups = {}, personProperties = {}, groupProperties = {}, extraPayload = {}) {
        return super.getFlags(distinctId, groups, personProperties, groupProperties, extraPayload);
    }
    getPersistedProperty(key) {
        return this.mocks.storage.getItem(key);
    }
    setPersistedProperty(key, value) {
        return this.mocks.storage.setItem(key, value);
    }
    fetch(url, options) {
        return this.mocks.fetch(url, options);
    }
    getLibraryId() {
        return 'posthog-core-tests';
    }
    getLibraryVersion() {
        return version;
    }
    getCustomUserAgent() {
        return 'posthog-core-tests';
    }
}
const createTestClient = (apiKey, options, setupMocks, storageCache = {})=>{
    const mocks = {
        fetch: jest.fn(),
        storage: {
            getItem: jest.fn((key)=>storageCache[key]),
            setItem: jest.fn((key, val)=>{
                storageCache[key] = null == val ? void 0 : val;
            })
        }
    };
    mocks.fetch.mockImplementation(()=>Promise.resolve({
            status: 200,
            text: ()=>Promise.resolve('ok'),
            json: ()=>Promise.resolve({
                    status: 'ok'
                })
        }));
    setupMocks?.(mocks);
    return [
        new PostHogCoreTestClient(mocks, apiKey, {
            disableCompression: true,
            ...options
        }),
        mocks
    ];
};
exports.PostHogCoreTestClient = __webpack_exports__.PostHogCoreTestClient;
exports.createTestClient = __webpack_exports__.createTestClient;
for(var __webpack_i__ in __webpack_exports__)if (-1 === [
    "PostHogCoreTestClient",
    "createTestClient"
].indexOf(__webpack_i__)) exports[__webpack_i__] = __webpack_exports__[__webpack_i__];
Object.defineProperty(exports, '__esModule', {
    value: true
});
