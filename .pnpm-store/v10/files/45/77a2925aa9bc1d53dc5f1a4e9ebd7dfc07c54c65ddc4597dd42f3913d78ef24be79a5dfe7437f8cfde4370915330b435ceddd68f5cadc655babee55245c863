// src/vendor/hash-wasm/sha256.js
var Module = (() => {
  var _unused = import.meta.url;
  return function(moduleArg = {}) {
    var Module2 = moduleArg;
    var readyPromiseResolve, readyPromiseReject;
    Module2["ready"] = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
    var moduleOverrides = Object.assign({}, Module2);
    var arguments_ = [];
    var thisProgram = "./this.program";
    var quit_ = (status, toThrow) => {
      throw toThrow;
    };
    var ENVIRONMENT_IS_WEB = typeof window == "object";
    var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
    var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
    var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
    var scriptDirectory = "";
    function locateFile(path) {
      if (Module2["locateFile"]) {
        return Module2["locateFile"](path, scriptDirectory);
      }
      return scriptDirectory + path;
    }
    var read_, readAsync, readBinary;
    if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href;
      } else if (typeof document != "undefined" && document.currentScript) {
        scriptDirectory = document.currentScript.src;
      }
      if (false) {
        scriptDirectory = false;
      }
      if (scriptDirectory.startsWith("blob:")) {
        scriptDirectory = "";
      } else {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
      }
      {
        read_ = (url) => {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.send(null);
          return xhr.responseText;
        };
        if (ENVIRONMENT_IS_WORKER) {
          readBinary = (url) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(
              /** @type{!ArrayBuffer} */
              xhr.response
            );
          };
        }
        readAsync = (url, onload, onerror) => {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => {
            if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
              onload(xhr.response);
              return;
            }
            onerror();
          };
          xhr.onerror = onerror;
          xhr.send(null);
        };
      }
    } else {
    }
    var out = Module2["print"] || console.log.bind(console);
    var err = Module2["printErr"] || console.error.bind(console);
    Object.assign(Module2, moduleOverrides);
    moduleOverrides = null;
    if (Module2["arguments"])
      arguments_ = Module2["arguments"];
    if (Module2["thisProgram"])
      thisProgram = Module2["thisProgram"];
    if (Module2["quit"])
      quit_ = Module2["quit"];
    var wasmBinary;
    if (Module2["wasmBinary"])
      wasmBinary = Module2["wasmBinary"];
    if (typeof WebAssembly != "object") {
      abort("no native wasm support detected");
    }
    function intArrayFromBase64(s) {
      var decoded = atob(s);
      var bytes = new Uint8Array(decoded.length);
      for (var i = 0; i < decoded.length; ++i) {
        bytes[i] = decoded.charCodeAt(i);
      }
      return bytes;
    }
    function tryParseAsDataURI(filename) {
      if (!isDataURI(filename)) {
        return;
      }
      return intArrayFromBase64(filename.slice(dataURIPrefix.length));
    }
    var wasmMemory;
    var ABORT = false;
    var EXITSTATUS;
    function assert(condition, text) {
      if (!condition) {
        abort(text);
      }
    }
    var HEAP, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
    function updateMemoryViews() {
      var b = wasmMemory.buffer;
      Module2["HEAP8"] = HEAP8 = new Int8Array(b);
      Module2["HEAP16"] = HEAP16 = new Int16Array(b);
      Module2["HEAPU8"] = HEAPU8 = new Uint8Array(b);
      Module2["HEAPU16"] = HEAPU16 = new Uint16Array(b);
      Module2["HEAP32"] = HEAP32 = new Int32Array(b);
      Module2["HEAPU32"] = HEAPU32 = new Uint32Array(b);
      Module2["HEAPF32"] = HEAPF32 = new Float32Array(b);
      Module2["HEAPF64"] = HEAPF64 = new Float64Array(b);
    }
    var __ATPRERUN__ = [];
    var __ATINIT__ = [];
    var __ATEXIT__ = [];
    var __ATPOSTRUN__ = [];
    var runtimeInitialized = false;
    function preRun() {
      if (Module2["preRun"]) {
        if (typeof Module2["preRun"] == "function")
          Module2["preRun"] = [Module2["preRun"]];
        while (Module2["preRun"].length) {
          addOnPreRun(Module2["preRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPRERUN__);
    }
    function initRuntime() {
      runtimeInitialized = true;
      callRuntimeCallbacks(__ATINIT__);
    }
    function postRun() {
      if (Module2["postRun"]) {
        if (typeof Module2["postRun"] == "function")
          Module2["postRun"] = [Module2["postRun"]];
        while (Module2["postRun"].length) {
          addOnPostRun(Module2["postRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPOSTRUN__);
    }
    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb);
    }
    function addOnInit(cb) {
      __ATINIT__.unshift(cb);
    }
    function addOnExit(cb) {
    }
    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb);
    }
    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null;
    function getUniqueRunDependency(id) {
      return id;
    }
    function addRunDependency(id) {
      runDependencies++;
      Module2["monitorRunDependencies"]?.(runDependencies);
    }
    function removeRunDependency(id) {
      runDependencies--;
      Module2["monitorRunDependencies"]?.(runDependencies);
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback();
        }
      }
    }
    function abort(what) {
      Module2["onAbort"]?.(what);
      what = "Aborted(" + what + ")";
      err(what);
      ABORT = true;
      EXITSTATUS = 1;
      what += ". Build with -sASSERTIONS for more info.";
      var e = new WebAssembly.RuntimeError(what);
      readyPromiseReject(e);
      throw e;
    }
    var dataURIPrefix = "data:application/octet-stream;base64,";
    var isDataURI = (filename) => filename.startsWith(dataURIPrefix);
    var isFileURI = (filename) => filename.startsWith("file://");
    var wasmBinaryFile;
    wasmBinaryFile = "data:application/octet-stream;base64,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";
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = locateFile(wasmBinaryFile);
    }
    function getBinarySync(file) {
      if (file == wasmBinaryFile && wasmBinary) {
        return new Uint8Array(wasmBinary);
      }
      var binary = tryParseAsDataURI(file);
      if (binary) {
        return binary;
      }
      if (readBinary) {
        return readBinary(file);
      }
      throw "both async and sync fetching of the wasm failed";
    }
    function getBinaryPromise(binaryFile) {
      return Promise.resolve().then(() => getBinarySync(binaryFile));
    }
    function instantiateArrayBuffer(binaryFile, imports, receiver) {
      return getBinaryPromise(binaryFile).then((binary) => {
        return WebAssembly.instantiate(binary, imports);
      }).then(receiver, (reason) => {
        err(`failed to asynchronously prepare wasm: ${reason}`);
        abort(reason);
      });
    }
    function instantiateAsync(binary, binaryFile, imports, callback) {
      return instantiateArrayBuffer(binaryFile, imports, callback);
    }
    function createWasm() {
      var info = {
        "env": wasmImports,
        "wasi_snapshot_preview1": wasmImports
      };
      function receiveInstance(instance, module) {
        wasmExports = instance.exports;
        wasmMemory = wasmExports["memory"];
        updateMemoryViews();
        addOnInit(wasmExports["__wasm_call_ctors"]);
        removeRunDependency("wasm-instantiate");
        return wasmExports;
      }
      addRunDependency("wasm-instantiate");
      function receiveInstantiationResult(result) {
        receiveInstance(result["instance"]);
      }
      if (Module2["instantiateWasm"]) {
        try {
          return Module2["instantiateWasm"](info, receiveInstance);
        } catch (e) {
          err(`Module.instantiateWasm callback failed with error: ${e}`);
          readyPromiseReject(e);
        }
      }
      instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult).catch(readyPromiseReject);
      return {};
    }
    var tempDouble;
    var tempI64;
    function ExitStatus(status) {
      this.name = "ExitStatus";
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }
    var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        callbacks.shift()(Module2);
      }
    };
    function getValue(ptr, type = "i8") {
      if (type.endsWith("*"))
        type = "*";
      switch (type) {
        case "i1":
          return HEAP8[ptr];
        case "i8":
          return HEAP8[ptr];
        case "i16":
          return HEAP16[ptr >> 1];
        case "i32":
          return HEAP32[ptr >> 2];
        case "i64":
          abort("to do getValue(i64) use WASM_BIGINT");
        case "float":
          return HEAPF32[ptr >> 2];
        case "double":
          return HEAPF64[ptr >> 3];
        case "*":
          return HEAPU32[ptr >> 2];
        default:
          abort(`invalid type for getValue: ${type}`);
      }
    }
    var noExitRuntime = Module2["noExitRuntime"] || true;
    function setValue(ptr, value, type = "i8") {
      if (type.endsWith("*"))
        type = "*";
      switch (type) {
        case "i1":
          HEAP8[ptr] = value;
          break;
        case "i8":
          HEAP8[ptr] = value;
          break;
        case "i16":
          HEAP16[ptr >> 1] = value;
          break;
        case "i32":
          HEAP32[ptr >> 2] = value;
          break;
        case "i64":
          abort("to do setValue(i64) use WASM_BIGINT");
        case "float":
          HEAPF32[ptr >> 2] = value;
          break;
        case "double":
          HEAPF64[ptr >> 3] = value;
          break;
        case "*":
          HEAPU32[ptr >> 2] = value;
          break;
        default:
          abort(`invalid type for setValue: ${type}`);
      }
    }
    var wasmImports = {};
    var wasmExports = createWasm();
    var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports["__wasm_call_ctors"])();
    var _Hash_Update = Module2["_Hash_Update"] = (a0) => (_Hash_Update = Module2["_Hash_Update"] = wasmExports["Hash_Update"])(a0);
    var _Hash_Final = Module2["_Hash_Final"] = () => (_Hash_Final = Module2["_Hash_Final"] = wasmExports["Hash_Final"])();
    var _Hash_Init = Module2["_Hash_Init"] = (a0) => (_Hash_Init = Module2["_Hash_Init"] = wasmExports["Hash_Init"])(a0);
    var _GetBufferPtr = Module2["_GetBufferPtr"] = () => (_GetBufferPtr = Module2["_GetBufferPtr"] = wasmExports["GetBufferPtr"])();
    var stackSave = () => (stackSave = wasmExports["stackSave"])();
    var stackRestore = (a0) => (stackRestore = wasmExports["stackRestore"])(a0);
    var stackAlloc = (a0) => (stackAlloc = wasmExports["stackAlloc"])(a0);
    var calledRun;
    dependenciesFulfilled = function runCaller() {
      if (!calledRun)
        run();
      if (!calledRun)
        dependenciesFulfilled = runCaller;
    };
    function run() {
      if (runDependencies > 0) {
        return;
      }
      preRun();
      if (runDependencies > 0) {
        return;
      }
      function doRun() {
        if (calledRun)
          return;
        calledRun = true;
        Module2["calledRun"] = true;
        if (ABORT)
          return;
        initRuntime();
        readyPromiseResolve(Module2);
        if (Module2["onRuntimeInitialized"])
          Module2["onRuntimeInitialized"]();
        postRun();
      }
      if (Module2["setStatus"]) {
        Module2["setStatus"]("Running...");
        setTimeout(function() {
          setTimeout(function() {
            Module2["setStatus"]("");
          }, 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }
    }
    if (Module2["preInit"]) {
      if (typeof Module2["preInit"] == "function")
        Module2["preInit"] = [Module2["preInit"]];
      while (Module2["preInit"].length > 0) {
        Module2["preInit"].pop()();
      }
    }
    run();
    return moduleArg.ready;
  };
})();
var sha256_default = Module;

// src/vendor/hash-wasm/sha256-wrapper.ts
async function createSHA256(isInsideWorker = false) {
  const BUFFER_MAX_SIZE = 8 * 1024 * 1024;
  const wasm = isInsideWorker ? (
    // @ts-expect-error WasmModule will be populated inside self object
    await self["SHA256WasmModule"]()
  ) : await sha256_default();
  const heap = wasm.HEAPU8.subarray(wasm._GetBufferPtr());
  return {
    init() {
      wasm._Hash_Init(256);
    },
    update(data) {
      let byteUsed = 0;
      while (byteUsed < data.byteLength) {
        const bytesLeft = data.byteLength - byteUsed;
        const length = Math.min(bytesLeft, BUFFER_MAX_SIZE);
        heap.set(data.subarray(byteUsed, byteUsed + length));
        wasm._Hash_Update(length);
        byteUsed += length;
      }
    },
    digest(method) {
      if (method !== "hex") {
        throw new Error("Only digest hex is supported");
      }
      wasm._Hash_Final();
      const result = Array.from(heap.slice(0, 32));
      return result.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  };
}
function createSHA256WorkerCode() {
  return `
		self.addEventListener('message', async (event) => {
      const { file } = event.data;
      const sha256 = await self.createSHA256(true);
      sha256.init();
      const reader = file.stream().getReader();
      const total = file.size;
      let bytesDone = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        sha256.update(value);
        bytesDone += value.length;
        postMessage({ progress: bytesDone / total });
      }
      postMessage({ sha256: sha256.digest('hex') });
    });
    self.SHA256WasmModule = ${sha256_default.toString()};
    self.createSHA256 = ${createSHA256.toString()};
  `;
}
export {
  createSHA256,
  createSHA256WorkerCode
};
