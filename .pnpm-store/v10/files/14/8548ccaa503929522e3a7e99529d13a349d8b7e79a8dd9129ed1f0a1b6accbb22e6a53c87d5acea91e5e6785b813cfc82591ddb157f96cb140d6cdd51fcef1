// src/workers/email/constants.ts
var RAW_EMAIL = "EmailMessage::raw";

// src/workers/email/email.worker.ts
var EmailMessage = class {
  constructor(from, to, raw) {
    this.from = from;
    this.to = to;
    this.raw = raw;
    return {
      from,
      to,
      // @ts-expect-error We need to be able to access the raw contents of an EmailMessage in entry.worker.ts
      [RAW_EMAIL]: raw
    };
  }
}, email_worker_default = {
  EmailMessage
};
export {
  email_worker_default as default
};
//# sourceMappingURL=email.worker.js.map
