var ie = Object.defineProperty;
var t = (i, o) => ie(i, "name", { value: o, configurable: !0 });

// ../node_modules/ts-dedent/esm/index.js
function n(i) {
  for (var o = [], e = 1; e < arguments.length; e++)
    o[e - 1] = arguments[e];
  var a = Array.from(typeof i == "string" ? [i] : i);
  a[a.length - 1] = a[a.length - 1].replace(/\r?\n([\t ]*)$/, "");
  var y = a.reduce(function(c, m) {
    var p = m.match(/\n([\t ]+|(?!\s).)/g);
    return p ? c.concat(p.map(function(E) {
      var d, l;
      return (l = (d = E.match(/[\t ]/g)) === null || d === void 0 ? void 0 : d.length) !== null && l !== void 0 ? l : 0;
    })) : c;
  }, []);
  if (y.length) {
    var h = new RegExp(`
[	 ]{` + Math.min.apply(Math, y) + "}", "g");
    a = a.map(function(c) {
      return c.replace(h, `
`);
    });
  }
  a[0] = a[0].replace(/^\r?\n/, "");
  var u = a[0];
  return o.forEach(function(c, m) {
    var p = u.match(/(?:^|\n)( *)$/), E = p ? p[1] : "", d = c;
    typeof c == "string" && c.includes(`
`) && (d = String(c).split(`
`).map(function(l, ae) {
      return ae === 0 ? l : "" + E + l;
    }).join(`
`)), u += d + a[m + 1];
  }), u;
}
t(n, "dedent");

// src/storybook-error.ts
function j({
  code: i,
  category: o
}) {
  let e = String(i).padStart(4, "0");
  return `SB_${o}_${e}`;
}
t(j, "parseErrorCode");
function L(i) {
  if (/^(?!.*storybook\.js\.org)|[?&]ref=error\b/.test(i))
    return i;
  try {
    let o = new URL(i);
    return o.searchParams.set("ref", "error"), o.toString();
  } catch {
    return i;
  }
}
t(L, "appendErrorRef");
var g = class g extends Error {
  constructor(e) {
    super(g.getFullMessage(e));
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
    return j({ code: this.code, category: this.category });
  }
  /** Overrides the default `Error.name` property in the format: SB_<CATEGORY>_<CODE>. */
  get name() {
    let e = this.constructor.name;
    return `${this.fullErrorCode} (${e})`;
  }
  /** Generates the error message along with additional documentation link (if applicable). */
  static getFullMessage({
    documentation: e,
    code: a,
    category: y,
    message: h
  }) {
    let u;
    return e === !0 ? u = `https://storybook.js.org/error/${j({ code: a, category: y })}?ref=error` : typeof e == "string" ? u = L(e) : Array.
    isArray(e) && (u = `
${e.map((c) => `	- ${L(c)}`).join(`
`)}`), `${h}${u != null ? `

More info: ${u}
` : ""}`;
  }
};
t(g, "StorybookError");
var s = g;

// src/preview-errors.ts
var ce = /* @__PURE__ */ ((r) => (r.BLOCKS = "BLOCKS", r.DOCS_TOOLS = "DOCS-TOOLS", r.PREVIEW_CLIENT_LOGGER = "PREVIEW_CLIENT-LOGGER", r.PREVIEW_CHANNELS =
"PREVIEW_CHANNELS", r.PREVIEW_CORE_EVENTS = "PREVIEW_CORE-EVENTS", r.PREVIEW_INSTRUMENTER = "PREVIEW_INSTRUMENTER", r.PREVIEW_API = "PREVIEW\
_API", r.PREVIEW_REACT_DOM_SHIM = "PREVIEW_REACT-DOM-SHIM", r.PREVIEW_ROUTER = "PREVIEW_ROUTER", r.PREVIEW_THEMING = "PREVIEW_THEMING", r.RENDERER_HTML =
"RENDERER_HTML", r.RENDERER_PREACT = "RENDERER_PREACT", r.RENDERER_REACT = "RENDERER_REACT", r.RENDERER_SERVER = "RENDERER_SERVER", r.RENDERER_SVELTE =
"RENDERER_SVELTE", r.RENDERER_VUE = "RENDERER_VUE", r.RENDERER_VUE3 = "RENDERER_VUE3", r.RENDERER_WEB_COMPONENTS = "RENDERER_WEB-COMPONENTS",
r.FRAMEWORK_NEXTJS = "FRAMEWORK_NEXTJS", r.ADDON_VITEST = "ADDON_VITEST", r.ADDON_A11Y = "ADDON_A11Y", r))(ce || {}), f = class f extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 1,
      message: n`
        Couldn't find story matching id '${e.storyId}' after HMR.
        - Did you just rename a story?
        - Did you remove it from your CSF file?
        - Are you sure a story with the id '${e.storyId}' exists?
        - Please check the values in the stories field of your main.js config and see if they would match your CSF File.
        - Also check the browser console and terminal for potential error messages.`
    });
    this.data = e;
  }
};
t(f, "MissingStoryAfterHmrError");
var Y = f, b = class b extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 2,
      documentation: "https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#using-implicit-actions-during-rendering-is-deprecated-\
for-example-in-the-play-function",
      message: n`
        We detected that you use an implicit action arg while ${e.phase} of your story.  
        ${e.deprecated ? `
This is deprecated and won't work in Storybook 8 anymore.
` : ""}
        Please provide an explicit spy to your args like this:
          import { fn } from 'storybook/test';
          ... 
          args: {
           ${e.name}: fn()
          }`
    });
    this.data = e;
  }
};
t(b, "ImplicitActionsDuringRendering");
var G = b, R = class R extends s {
  constructor() {
    super({
      category: "PREVIEW_API",
      code: 3,
      message: n`
        Cannot call \`storyStore.extract()\` without calling \`storyStore.cacheAllCsfFiles()\` first.

        You probably meant to call \`await preview.extract()\` which does the above for you.`
    });
  }
};
t(R, "CalledExtractOnStoreError");
var F = R, I = class I extends s {
  constructor() {
    super({
      category: "PREVIEW_API",
      code: 4,
      message: n`
        Expected your framework's preset to export a \`renderToCanvas\` field.

        Perhaps it needs to be upgraded for Storybook 7.0?`,
      documentation: "https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mainjs-framework-field"
    });
  }
};
t(I, "MissingRenderToCanvasError");
var H = I, x = class x extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 5,
      message: n`
        Called \`Preview.${e.methodName}()\` before initialization.
        
        The preview needs to load the story index before most methods can be called. If you want
        to call \`${e.methodName}\`, try \`await preview.initializationPromise;\` first.
        
        If you didn't call the above code, then likely it was called by an addon that needs to
        do the above.`
    });
    this.data = e;
  }
};
t(x, "CalledPreviewMethodBeforeInitializationError");
var M = x, P = class P extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 6,
      message: n`
        Error fetching \`/index.json\`:
        
        ${e.text}

        If you are in development, this likely indicates a problem with your Storybook process,
        check the terminal for errors.

        If you are in a deployed Storybook, there may have been an issue deploying the full Storybook
        build.`
    });
    this.data = e;
  }
};
t(P, "StoryIndexFetchError");
var K = P, w = class w extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 7,
      message: n`
        Tried to render docs entry ${e.storyId} but it is a MDX file that has no CSF
        references, or autodocs for a CSF file that some doesn't refer to itself.
        
        This likely is an internal error in Storybook's indexing, or you've attached the
        \`attached-mdx\` tag to an MDX file that is not attached.`
    });
    this.data = e;
  }
};
t(w, "MdxFileWithNoCsfReferencesError");
var U = w, T = class T extends s {
  constructor() {
    super({
      category: "PREVIEW_API",
      code: 8,
      message: n`
        Couldn't find any stories in your Storybook.

        - Please check your stories field of your main.js config: does it match correctly?
        - Also check the browser console and terminal for error messages.`
    });
  }
};
t(T, "EmptyIndexError");
var X = T, S = class S extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 9,
      message: n`
        Couldn't find story matching '${e.storySpecifier}'.

        - Are you sure a story with that id exists?
        - Please check your stories field of your main.js config.
        - Also check the browser console and terminal for error messages.`
    });
    this.data = e;
  }
};
t(S, "NoStoryMatchError");
var J = S, k = class k extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 10,
      message: n`
        Couldn't find story matching id '${e.storyId}' after importing a CSF file.

        The file was indexed as if the story was there, but then after importing the file in the browser
        we didn't find the story. Possible reasons:
        - You are using a custom story indexer that is misbehaving.
        - You have a custom file loader that is removing or renaming exports.

        Please check your browser console and terminal for errors that may explain the issue.`
    });
    this.data = e;
  }
};
t(k, "MissingStoryFromCsfFileError");
var q = k, v = class v extends s {
  constructor() {
    super({
      category: "PREVIEW_API",
      code: 11,
      message: n`
        Cannot access the Story Store until the index is ready.

        It is not recommended to use methods directly on the Story Store anyway, in Storybook 9 we will
        remove access to the store entirely`
    });
  }
};
t(v, "StoryStoreAccessedBeforeInitializationError");
var z = v, _ = class _ extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 12,
      message: n`
      Incorrect use of mount in the play function.
      
      To use mount in the play function, you must satisfy the following two requirements: 
      
      1. You *must* destructure the mount property from the \`context\` (the argument passed to your play function). 
         This makes sure that Storybook does not start rendering the story before the play function begins.
      
      2. Your Storybook framework or builder must be configured to transpile to ES2017 or newer. 
         This is because destructuring statements and async/await usages are otherwise transpiled away, 
         which prevents Storybook from recognizing your usage of \`mount\`.
      
      Note that Angular is not supported. As async/await is transpiled to support the zone.js polyfill. 
      
      More info: https://storybook.js.org/docs/writing-tests/interaction-testing?ref=error#run-code-before-the-component-gets-rendered
      
      Received the following play function:
      ${e.playFunction}`
    });
    this.data = e;
  }
};
t(_, "MountMustBeDestructuredError");
var B = _, N = class N extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 14,
      message: n`
        No render function available for storyId '${e.id}'
      `
    });
    this.data = e;
  }
};
t(N, "NoRenderFunctionError");
var Q = N, V = class V extends s {
  constructor() {
    super({
      category: "PREVIEW_API",
      code: 15,
      message: n`
        No component is mounted in your story.
        
        This usually occurs when you destructure mount in the play function, but forget to call it.
        
        For example:

        async play({ mount, canvasElement }) {
          // 👈 mount should be called: await mount(); 
          const canvas = within(canvasElement);
          const button = await canvas.findByRole('button');
          await userEvent.click(button);
        };

        Make sure to either remove it or call mount in your play function.
      `
    });
  }
};
t(V, "NoStoryMountedError");
var Z = V, A = class A extends s {
  constructor(e) {
    super({
      category: "PREVIEW_API",
      code: 16,
      message: `Status has typeId "${e.status.typeId}" but was added to store with typeId "${e.typeId}". Full status: ${JSON.stringify(
        e.status,
        null,
        2
      )}`
    });
    this.data = e;
  }
};
t(A, "StatusTypeIdMismatchError");
var ee = A, O = class O extends s {
  constructor() {
    super({
      category: "FRAMEWORK_NEXTJS",
      code: 1,
      documentation: "https://storybook.js.org/docs/get-started/nextjs#faq",
      message: n`
      You are importing avif images, but you don't have sharp installed.

      You have to install sharp in order to use image optimization features in Next.js.
      `
    });
  }
};
t(O, "NextJsSharpError");
var te = O, W = class W extends s {
  constructor(e) {
    super({
      category: "FRAMEWORK_NEXTJS",
      code: 2,
      message: n`
        Tried to access router mocks from "${e.importType}" but they were not created yet. You might be running code in an unsupported environment.
      `
    });
    this.data = e;
  }
};
t(W, "NextjsRouterMocksNotAvailable");
var oe = W, $ = class $ extends s {
  constructor(e) {
    super({
      category: "DOCS-TOOLS",
      code: 1,
      documentation: "https://github.com/storybookjs/storybook/issues/26606",
      message: n`
        There was a failure when generating detailed ArgTypes in ${e.language} for:
        ${JSON.stringify(e.type, null, 2)} 
        
        Storybook will fall back to use a generic type description instead.

        This type is either not supported or it is a bug in the docgen generation in Storybook.
        If you think this is a bug, please detail it as much as possible in the Github issue.
      `
    });
    this.data = e;
  }
};
t($, "UnknownArgTypesError");
var se = $, D = class D extends s {
  constructor(e) {
    super({
      category: "ADDON_VITEST",
      code: 1,
      // TODO: Add documentation about viewports support
      // documentation: '',
      message: n`
        Encountered an unsupported value "${e.value}" when setting the viewport ${e.dimension} dimension.
        
        The Storybook plugin only supports values in the following units:
        - px, vh, vw, em, rem and %.
        
        You can either change the viewport for this story to use one of the supported units or skip the test by adding '!test' to the story's tags per https://storybook.js.org/docs/writing-stories/tags
      `
    });
    this.data = e;
  }
};
t(D, "UnsupportedViewportDimensionError");
var re = D, C = class C extends s {
  constructor() {
    super({
      category: "ADDON_A11Y",
      code: 1,
      documentation: "https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#a11y-addon-replace-element-parameter-with-context-para\
meter",
      message: 'The "element" parameter in parameters.a11y has been removed. Use "context" instead.'
    });
  }
};
t(C, "ElementA11yParameterError");
var ne = C;
export {
  F as CalledExtractOnStoreError,
  M as CalledPreviewMethodBeforeInitializationError,
  ce as Category,
  ne as ElementA11yParameterError,
  X as EmptyIndexError,
  G as ImplicitActionsDuringRendering,
  U as MdxFileWithNoCsfReferencesError,
  H as MissingRenderToCanvasError,
  Y as MissingStoryAfterHmrError,
  q as MissingStoryFromCsfFileError,
  B as MountMustBeDestructuredError,
  te as NextJsSharpError,
  oe as NextjsRouterMocksNotAvailable,
  Q as NoRenderFunctionError,
  J as NoStoryMatchError,
  Z as NoStoryMountedError,
  ee as StatusTypeIdMismatchError,
  K as StoryIndexFetchError,
  z as StoryStoreAccessedBeforeInitializationError,
  se as UnknownArgTypesError,
  re as UnsupportedViewportDimensionError
};
