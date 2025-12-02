"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Request = void 0;
const body_1 = require("./body");
const headers_1 = require("./headers");
const defaultInit = {
    allowForbiddenHeaders: false,
    cache: "default",
    credentials: "omit",
    method: "GET",
    mode: "same-origin",
    redirect: "manual",
    referrer: "client",
};
class Request extends body_1.Body {
    constructor(input, init) {
        super();
        const { url: overwriteUrl } = init || {};
        // TODO: Consider throwing a TypeError if the URL has credentials
        this._url =
            input instanceof Request
                ? (overwriteUrl || input._url)
                : (overwriteUrl || input);
        if (input instanceof Request) {
            if (input.hasBody())
                // Move body to this request
                this.setBody(input);
            const newInit = Object.assign({}, input, init);
            init = newInit;
            // TODO: Follow MDN:
            //       If this object exists on another origin to the
            //       constructor call, the Request.referrer is stripped out.
            //       If this object has a Request.mode of navigate, the mode
            //       value is converted to same-origin.
        }
        this._init = Object.assign({}, defaultInit, init);
        const allowForbiddenHeaders = this._init.allowForbiddenHeaders;
        const headers = new headers_1.GuardedHeaders(allowForbiddenHeaders
            ? "none"
            : this._init.mode === "no-cors"
                ? "request-no-cors"
                : "request", this._init.headers);
        if (this._init.body && this._init.json)
            throw new Error("Cannot specify both 'body' and 'json'");
        if (!this.hasBody() && this._init.body) {
            if (headers.has("content-type"))
                this.setBody(this._init.body, headers.get("content-type"));
            else
                this.setBody(this._init.body);
        }
        else if (!this.hasBody() && this._init.json) {
            this.setBody(new body_1.JsonBody(this._init.json));
        }
        Object.defineProperties(this, {
            allowForbiddenHeaders: {
                enumerable: true,
                value: allowForbiddenHeaders,
            },
            cache: {
                enumerable: true,
                value: this._init.cache,
            },
            credentials: {
                enumerable: true,
                value: this._init.credentials,
            },
            headers: {
                enumerable: true,
                value: headers,
            },
            integrity: {
                enumerable: true,
                value: this._init.integrity,
            },
            method: {
                enumerable: true,
                value: this._init.method,
            },
            mode: {
                enumerable: true,
                value: this._init.mode,
            },
            redirect: {
                enumerable: true,
                value: this._init.redirect,
            },
            referrer: {
                enumerable: true,
                value: this._init.referrer,
            },
            referrerPolicy: {
                enumerable: true,
                value: this._init.referrerPolicy,
            },
            url: {
                enumerable: true,
                value: this._url,
            },
        });
    }
    clone(newUrl) {
        return new Request(this, { url: newUrl });
    }
}
exports.Request = Request;
//# sourceMappingURL=request.js.map