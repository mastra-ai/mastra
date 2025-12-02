// src/workers/ratelimit/ratelimit.worker.ts
var RatelimitOptionKeys = ["key", "limit", "period"], RatelimitPeriodValues = [10, 60];
function validate(test, message) {
  if (!test)
    throw new Error(message);
}
var Ratelimit = class {
  namespaceId;
  limitVal;
  period;
  buckets;
  epoch;
  constructor(config) {
    this.namespaceId = config.namespaceId, this.limitVal = config.limit, this.period = config.period, this.buckets = /* @__PURE__ */ new Map(), this.epoch = 0;
  }
  // method that counts and checks against the limit in in-memory buckets
  async limit(options) {
    validate(
      typeof options == "object" && options !== null,
      "invalid rate limit options"
    );
    let invalidProps = Object.keys(options ?? {}).filter(
      (key2) => !RatelimitOptionKeys.includes(key2)
    );
    validate(
      invalidProps.length == 0,
      `bad rate limit options: [${invalidProps.join(",")}]`
    );
    let {
      key = "",
      limit = this.limitVal,
      period = this.period
    } = options;
    validate(typeof key == "string", `invalid key: ${key}`), validate(typeof limit == "number", `limit must be a number: ${limit}`), validate(typeof period == "number", `period must be a number: ${period}`), validate(
      RatelimitPeriodValues.includes(period),
      `unsupported period: ${period}`
    );
    let epoch = Math.floor(Date.now() / (period * 1e3));
    epoch != this.epoch && (this.epoch = epoch, this.buckets.clear());
    let val = this.buckets.get(key) || 0;
    return val >= limit ? {
      success: !1
    } : (this.buckets.set(key, val + 1), {
      success: !0
    });
  }
};
function ratelimit_worker_default(env) {
  return new Ratelimit(env);
}
export {
  ratelimit_worker_default as default
};
//# sourceMappingURL=ratelimit.worker.js.map
