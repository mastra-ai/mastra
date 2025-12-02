// src/middleware/trailing-slash/index.ts
var trimTrailingSlash = () => {
  return async function trimTrailingSlash2(c, next) {
    await next();
    if (c.res.status === 404 && (c.req.method === "GET" || c.req.method === "HEAD") && c.req.path !== "/" && c.req.path.at(-1) === "/") {
      const url = new URL(c.req.url);
      url.pathname = url.pathname.substring(0, url.pathname.length - 1);
      c.res = c.redirect(url.toString(), 301);
    }
  };
};
var appendTrailingSlash = () => {
  return async function appendTrailingSlash2(c, next) {
    await next();
    if (c.res.status === 404 && (c.req.method === "GET" || c.req.method === "HEAD") && c.req.path.at(-1) !== "/") {
      const url = new URL(c.req.url);
      url.pathname += "/";
      c.res = c.redirect(url.toString(), 301);
    }
  };
};
export {
  appendTrailingSlash,
  trimTrailingSlash
};
