// src/utils/handler.ts
import { COMPOSED_HANDLER } from "./constants.js";
var isMiddleware = (handler) => handler.length > 1;
var findTargetHandler = (handler) => {
  return handler[COMPOSED_HANDLER] ? findTargetHandler(handler[COMPOSED_HANDLER]) : handler;
};
export {
  findTargetHandler,
  isMiddleware
};
