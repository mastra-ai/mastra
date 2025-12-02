var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};

// src/getRawRequest.ts
var kRawRequest = Symbol("kRawRequest");
function getRawRequest(request) {
  return Reflect.get(request, kRawRequest);
}
function setRawRequest(request, rawRequest) {
  Reflect.set(request, kRawRequest, rawRequest);
}

export {
  __privateGet,
  __privateAdd,
  getRawRequest,
  setRawRequest
};
//# sourceMappingURL=chunk-YWNGXXUQ.mjs.map