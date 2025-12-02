import { expect, test } from "vitest";
import { toFetchResponse, toReqRes } from "./http-server";
import { Readable } from "node:stream";
test("multiple set-cookie headers", async () => {
    const { res: nodeRes } = toReqRes(new Request("https://example.com"));
    // taken from https://nodejs.org/api/http.html#responsesetheadername-value
    nodeRes.setHeader("Set-Cookie", ["type=ninja", "language=javascript"]);
    nodeRes.writeHead(200);
    nodeRes.end();
    const webResponse = await toFetchResponse(nodeRes);
    expect(webResponse.status).toEqual(200);
    expect(webResponse.headers.get("set-cookie")).toEqual("type=ninja, language=javascript");
});
test("works with a single write", async () => {
    const { res: nodeRes } = toReqRes(new Request("https://example.com"));
    nodeRes.write("abcd");
    nodeRes.end();
    const webResponse = await toFetchResponse(nodeRes);
    expect(webResponse.status).toEqual(200);
    expect(webResponse.headers.get("transfer-encoding")).toEqual("chunked");
    expect(await webResponse.text()).toEqual("abcd");
});
test("works with multiple writes", async () => {
    const { res: nodeRes } = toReqRes(new Request("https://example.com"));
    nodeRes.write("abcd");
    nodeRes.write("efgh");
    nodeRes.end();
    const webResponse = await toFetchResponse(nodeRes);
    expect(webResponse.status).toEqual(200);
    expect(webResponse.headers.get("transfer-encoding")).toEqual("chunked");
    expect(await webResponse.text()).toEqual("abcdefgh");
});
test("works with a pipe", async () => {
    const { res: nodeRes } = toReqRes(new Request("https://example.com"));
    Readable.from(["abcd", "efgh"]).pipe(nodeRes);
    const webResponse = await toFetchResponse(nodeRes);
    console.log([...webResponse.headers]);
    expect(webResponse.status).toEqual(200);
    expect(webResponse.headers.get("transfer-encoding")).toEqual("chunked");
    expect(await webResponse.text()).toEqual("abcdefgh");
});
test("works with a fixed length body", async () => {
    const { res: nodeRes } = toReqRes(new Request("https://example.com"));
    const body = "abcd🎉";
    nodeRes.setHeader("Content-Length", Buffer.byteLength(body));
    nodeRes.end(body);
    const webResponse = await toFetchResponse(nodeRes);
    console.log([...webResponse.headers]);
    expect(webResponse.status).toEqual(200);
    expect(webResponse.headers.get("content-length")).toEqual("8");
    expect(webResponse.headers.has("transfer-encoding")).toEqual(false);
    expect(await webResponse.text()).toEqual(body);
});
