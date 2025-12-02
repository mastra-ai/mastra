var f = Object.defineProperty;
var o = (r, t) => f(r, "name", { value: t, configurable: !0 });

// src/storybook-error.ts
function d({
  code: r,
  category: t
}) {
  let e = String(r).padStart(4, "0");
  return `SB_${t}_${e}`;
}
o(d, "parseErrorCode");
function l(r) {
  if (/^(?!.*storybook\.js\.org)|[?&]ref=error\b/.test(r))
    return r;
  try {
    let t = new URL(r);
    return t.searchParams.set("ref", "error"), t.toString();
  } catch {
    return r;
  }
}
o(l, "appendErrorRef");
var a = class a extends Error {
  constructor(e) {
    super(a.getFullMessage(e));
    /**
     * Data associated with the error. Used to provide additional information in the error message or
     * to be passed to telemetry.
     */
    this.data = {};
    /** Flag used to easily determine if the error originates from Storybook. */
    this.fromStorybook = !0;
    this.category = e.category, this.documentation = e.documentation ?? !1, this.code = e.code;
  }
  get fullErrorCode() {
    return d({ code: this.code, category: this.category });
  }
  /** Overrides the default `Error.name` property in the format: SB_<CATEGORY>_<CODE>. */
  get name() {
    let e = this.constructor.name;
    return `${this.fullErrorCode} (${e})`;
  }
  /** Generates the error message along with additional documentation link (if applicable). */
  static getFullMessage({
    documentation: e,
    code: p,
    category: y,
    message: R
  }) {
    let c;
    return e === !0 ? c = `https://storybook.js.org/error/${d({ code: p, category: y })}?ref=error` : typeof e == "string" ? c = l(e) : Array.
    isArray(e) && (c = `
${e.map((G) => `	- ${l(G)}`).join(`
`)}`), `${R}${c != null ? `

More info: ${c}
` : ""}`;
  }
};
o(a, "StorybookError");
var n = a;

// src/manager-errors.ts
var b = /* @__PURE__ */ ((s) => (s.MANAGER_UNCAUGHT = "MANAGER_UNCAUGHT", s.MANAGER_UI = "MANAGER_UI", s.MANAGER_API = "MANAGER_API", s.MANAGER_CLIENT_LOGGER =
"MANAGER_CLIENT-LOGGER", s.MANAGER_CHANNELS = "MANAGER_CHANNELS", s.MANAGER_CORE_EVENTS = "MANAGER_CORE-EVENTS", s.MANAGER_ROUTER = "MANAGER\
_ROUTER", s.MANAGER_THEMING = "MANAGER_THEMING", s))(b || {}), A = class A extends n {
  constructor() {
    super({
      category: "MANAGER_UI",
      code: 1,
      message: "The Provider passed into Storybook's UI is not extended from the base Provider. Please check your Provider implementation."
    });
  }
};
o(A, "ProviderDoesNotExtendBaseProviderError");
var E = A, i = class i extends n {
  constructor(e) {
    super({
      category: "MANAGER_UNCAUGHT",
      code: 1,
      message: e.error.message
    });
    this.data = e;
    this.stack = e.error.stack;
  }
};
o(i, "UncaughtManagerError");
var N = i, u = class u extends n {
  constructor(e) {
    super({
      category: "MANAGER_API",
      code: 1,
      message: `Status has typeId "${e.status.typeId}" but was added to store with typeId "${e.typeId}". Full status: ${JSON.stringify(
        e.status,
        null,
        2
      )}`
    });
    this.data = e;
  }
};
o(u, "StatusTypeIdMismatchError");
var g = u;
export {
  b as Category,
  E as ProviderDoesNotExtendBaseProviderError,
  g as StatusTypeIdMismatchError,
  N as UncaughtManagerError
};
