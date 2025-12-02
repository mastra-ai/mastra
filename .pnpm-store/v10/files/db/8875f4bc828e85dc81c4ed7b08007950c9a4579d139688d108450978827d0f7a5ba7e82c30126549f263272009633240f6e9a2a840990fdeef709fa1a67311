import { PostHogCore } from "../posthog-core.mjs";
const version = '2.0.0-alpha';
class PostHogCoreTestClient extends PostHogCore {
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
export { PostHogCoreTestClient, createTestClient };
