// src/authorization-errors.ts
var REVERIFICATION_REASON = "reverification-error";
var reverificationError = (missingConfig) => ({
  clerk_error: {
    type: "forbidden",
    reason: REVERIFICATION_REASON,
    metadata: {
      reverification: missingConfig
    }
  }
});
var reverificationErrorResponse = (...args) => new Response(JSON.stringify(reverificationError(...args)), {
  status: 403
});
var isReverificationHint = (result) => {
  return result && typeof result === "object" && "clerk_error" in result && result.clerk_error?.type === "forbidden" && result.clerk_error?.reason === REVERIFICATION_REASON;
};

export {
  reverificationError,
  reverificationErrorResponse,
  isReverificationHint
};
//# sourceMappingURL=chunk-43A5F2IE.mjs.map