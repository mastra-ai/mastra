// src/workers/media/binding.worker.ts
import { RpcTarget, WorkerEntrypoint } from "cloudflare:workers";
var MediaBinding = class extends WorkerEntrypoint {
  async input(media) {
    return new MediaTransformer(this.env.remote, media);
  }
}, MediaTransformer = class extends RpcTarget {
  constructor(remote, input) {
    super();
    this.remote = remote;
    this.input = input;
  }
  transform(options) {
    return new MediaTransformationGenerator(this.remote, this.input, options);
  }
}, MediaTransformationGenerator = class extends RpcTarget {
  constructor(remote, input, inputOptions) {
    super();
    this.remote = remote;
    this.input = input;
    this.inputOptions = inputOptions;
  }
  async output(outputOptions) {
    let resp = await this.remote.fetch("http://example.com", {
      body: this.input,
      method: "POST",
      headers: {
        "x-cf-media-input-options": JSON.stringify(this.inputOptions),
        "x-cf-media-output-options": JSON.stringify(outputOptions)
      }
    }), contentType = resp.headers.get("x-cf-media-content-type");
    return new MediaTransformationResult(
      resp.body,
      contentType
    );
  }
}, MediaTransformationResult = class extends RpcTarget {
  constructor(responseStream, responseContentType) {
    super();
    this.responseStream = responseStream;
    this.responseContentType = responseContentType;
  }
  media() {
    let [stream1, stream2] = this.responseStream.tee();
    return this.responseStream = stream1, stream2;
  }
  response() {
    let [stream1, stream2] = this.responseStream.tee();
    return this.responseStream = stream1, new Response(stream2, {
      headers: {
        "Content-Type": this.contentType()
      }
    });
  }
  contentType() {
    return this.responseContentType;
  }
};
export {
  MediaBinding as default
};
//# sourceMappingURL=binding.worker.js.map
