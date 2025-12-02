// src/utils/promiseWithResolvers.ts
var promiseWithResolvers = function() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  if (!resolve || !reject) throw new Error("Failed to create promise");
  return { promise, resolve, reject };
};
export {
  promiseWithResolvers
};
//# sourceMappingURL=promiseWithResolvers.js.map