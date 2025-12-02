const wait = async (t)=>{
    await new Promise((r)=>setTimeout(r, t));
};
const waitForPromises = async ()=>{
    await new Promise((resolve)=>{
        jest.useRealTimers();
        setTimeout(resolve, 10);
        jest.useFakeTimers();
    });
};
const parseBody = (mockCall)=>{
    const options = mockCall[1];
    expect(options.method).toBe('POST');
    return JSON.parse(options.body || '');
};
const createImperativePromise = ()=>{
    let resolve;
    const promise = new Promise((r)=>{
        resolve = r;
    });
    return [
        promise,
        (val)=>resolve?.(val)
    ];
};
const delay = (ms)=>new Promise((resolve)=>{
        setTimeout(resolve, ms);
    });
const createMockLogger = ()=>({
        info: jest.fn((...args)=>console.log(...args)),
        warn: jest.fn((...args)=>console.warn(...args)),
        error: jest.fn((...args)=>console.error(...args)),
        critical: jest.fn((...args)=>console.error(...args)),
        createLogger: createMockLogger
    });
export { createImperativePromise, createMockLogger, delay, parseBody, wait, waitForPromises };
