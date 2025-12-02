import { uuidv7 } from "../vendor/uuidv7.mjs";
class PromiseQueue {
    add(promise) {
        const promiseUUID = uuidv7();
        this.promiseByIds[promiseUUID] = promise;
        promise.catch(()=>{}).finally(()=>{
            delete this.promiseByIds[promiseUUID];
        });
        return promise;
    }
    async join() {
        let promises = Object.values(this.promiseByIds);
        let length = promises.length;
        while(length > 0){
            await Promise.all(promises);
            promises = Object.values(this.promiseByIds);
            length = promises.length;
        }
    }
    get length() {
        return Object.keys(this.promiseByIds).length;
    }
    constructor(){
        this.promiseByIds = {};
    }
}
export { PromiseQueue };
