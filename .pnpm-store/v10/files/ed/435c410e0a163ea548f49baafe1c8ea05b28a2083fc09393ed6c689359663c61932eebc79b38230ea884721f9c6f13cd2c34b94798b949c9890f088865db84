# Copyright (c) 2017-2022 Cloudflare, Inc.
# Licensed under the Apache 2.0 license found in the LICENSE file or at:
#     https://opensource.org/licenses/Apache-2.0

@0xe6afd26682091c01;
# This file defines the schema for configuring the workerd runtime.
#
# A config file can be written as a `.capnp` file that imports this file and then defines a
# constant of type `Config`. Alternatively, various higher-level tooling (e.g. wrangler) may
# generate configs for you, outputting a binary Cap'n Proto file.
#
# To start a server with a config, do:
#
#     workerd serve my-config.capnp constantName
#
# You can also build a new self-contained binary which combines the `workerd` binary with your
# configuration and all your source code:
#
#     workerd compile my-config.capnp constantName -o my-server-bin
#
# This binary can then be run stand-alone.
#
# A common theme in this configuration is capability-based design. We generally like to avoid
# giving a Worker the ability to access external resources by name, since this makes it hard
# to see and restrict what each Worker can access. Instead, the default is that a Worker has
# access to no privileged resources at all, and you must explicitly declare "bindings" to give
# it access to specific resources. A binding gives the Worker a JavaScript API object that points
# to a specific resource. This means that by changing config alone, you can fully control which
# resources an Worker connects to. (You can even disallow access to the public internet, although
# public internet access is granted by default.)
#
# This config format is fairly powerful, allowing you to do things like define a TLS-terminating
# reverse proxy server without using any actual JavaScript code. However, you should not be
# afraid to fall back to code for anything the config cannot express, as Workers are very fast
# to execute!

# Any capnp files imported here must be:
# 1. embedded using wd_cc_embed
# 2. added to `tryImportBulitin` in workerd.c++ (grep for '"/workerd/workerd.capnp"').
using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("workerd::server::config");
$Cxx.allowCancellation;

struct Config {
  # Top-level configuration for a workerd instance.

  services @0 :List(Service);
  # List of named services defined by this server. These names are private; they are only used
  # to refer to the services from elsewhere in this config file, as well as for logging and the
  # like. Services are not reachable until you configure some way to make them reachable, such
  # as via a Socket.
  #
  # If you do not define any service called "internet", one is defined implicitly, representing
  # the ability to access public internet servers. An explicit definition would look like:
  #
  #     ( name = "internet",
  #       network = (
  #         allow = ["public"],   # Allows connections to publicly-routable addresses only.
  #         tlsOptions = (trustBrowserCas = true)
  #       )
  #     )
  #
  # The "internet" service backs the global `fetch()` function in a Worker, unless that Worker's
  # configuration specifies some other service using the `globalOutbound` setting.

  sockets @1 :List(Socket);
  # List of sockets on which this server will listen, and the services that will be exposed
  # through them.

  v8Flags @2 :List(Text);
  # List of "command-line" flags to pass to V8, like "--expose-gc". We put these in the config
  # rather than on the actual command line because for most use cases, managing these via the
  # config file is probably cleaner and easier than passing on the actual CLI.
  #
  # WARNING: Use at your own risk. V8 flags can have all sorts of wild effects including completely
  #   breaking everything. V8 flags also generally do not come with any guarantee of stability
  #   between V8 versions. Most users should not set any V8 flags.

  extensions @3 :List(Extension);
  # Extensions provide capabilities to all workers. Extensions are usually prepared separately
  # and are late-linked with the app using this config field.

  autogates @4 :List(Text);
  # A list of gates which are enabled.
  # These are used to gate features/changes in workerd and in our internal repo. See the equivalent
  # config definition in our internal repo for more details.

  structuredLogging @5 :Bool = false;
  # If true, logs will be emitted as JSON for structured logging.
  # When false, logs use the traditional human-readable format.
  # This affects the format of logs from KJ_LOG and exception reporting as well as js logs.
  # This won't work for logs coming from service worker syntax workers with the old module registry.
  # Note: This field is obsolete and deprecated. Use the logging struct instead.

  logging @6 : LoggingOptions;
  # Console and Stdio logging configuration options.
}

struct LoggingOptions {
  structuredLogging @0 :Bool = false;
  # Override of top-level structured logging (only when true).
  # If true, logs will be emitted as JSON for structured logging.
  # When false, logs use the traditional human-readable format.
  # This affects the format of logs from KJ_LOG and exception reporting as well as js logs.
  # This won't work for logs coming from service worker syntax workers with the old module registry.

  stdoutPrefix @1 :Text;
  # Set a custom prefix for process.stdout. Defaults to "stdout: ".

  stderrPrefix @2 :Text;
  # Set a custom prefix for process.stderr. Defaults to "stderr: ".
}

# ========================================================================================
# Sockets

struct Socket {
  name @0 :Text;
  # Each socket has a unique name which can be used on the command line to override the socket's
  # address with `--socket-addr <name>=<addr>` or `--socket-fd <name>=<fd>`.

  address @1 :Text;
  # Address/port on which this socket will listen. Optional; if not specified, then you will be
  # required to specify the socket on the command line with with `--socket-addr <name>=<addr>` or
  # `--socket-fd <name>=<fd>`.
  #
  # Examples:
  # - "*:80": Listen on port 80 on all local IPv4 and IPv6 interfaces.
  # - "1.2.3.4": Listen on the specific IPv4 address on the default port for the protocol.
  # - "1.2.3.4:80": Listen on the specific IPv4 address and port.
  # - "1234:5678::abcd": Listen on the specific IPv6 address on the default port for the protocol.
  # - "[1234:5678::abcd]:80": Listen on the specific IPv6 address and port.
  # - "unix:/path/to/socket": Listen on a Unix socket.
  # - "unix-abstract:name": On Linux, listen on the given "abstract" Unix socket name.
  # - "example.com:80": Perform a DNS lookup to determine the address, and then listen on it. If
  #     this resolves to multiple addresses, listen on all of them.
  #
  # (These are the formats supported by KJ's parseAddress().)

  union {
    http @2 :HttpOptions;
    https :group {
      options @3 :HttpOptions;
      tlsOptions @4 :TlsOptions;
    }

    # TODO(someday): TCP, TCP proxy, SMTP, Cap'n Proto, ...
  }

  service @5 :ServiceDesignator;
  # Service name which should handle requests on this socket.

  # TODO(someday): Support mapping different hostnames to different services? Or should that be
  #   done strictly via JavaScript?
}

# ========================================================================================
# Services

struct Service {
  # Defines a named service. Each server has a list of named services. The names are private,
  # used to refer to the services within this same config file.

  name @0 :Text;
  # Name of the service. Used only to refer to the service from elsewhere in the config file.
  # Services are not accessible unless you explicitly configure them to be, such as through a
  # `Socket` or through a binding from another Worker.

  union {
    unspecified @1 :Void;
    # (This catches when someone forgets to specify one of the union members. Do not set this.)

    worker @2 :Worker;
    # A Worker!

    network @3 :Network;
    # A service that implements access to a network. fetch() requests are routed according to
    # the URL hostname.

    external @4 :ExternalServer;
    # A service that forwards all requests to a specific remote server. Typically used to
    # connect to a back-end server on your internal network.

    disk @5 :DiskDirectory;
    # An HTTP service backed by a directory on disk, supporting a basic HTTP GET/PUT. Generally
    # not intended to be exposed directly to the internet; typically you want to bind this into
    # a Worker that adds logic for setting Content-Type and the like.
  }

  # TODO(someday): Allow defining a list of middlewares to stack on top of the service. This would
  #   be a list of Worker names, where each Worker must have a binding called `next`. This
  #   implicitly creates an inherited worker that wraps this service, with the `next` binding
  #   pointing to the service itself (or to the next middleware in the stack).
}

struct ServiceDesignator {
  # A reference to a service from elsewhere in the config file, e.g. from a service binding in a
  # Worker.
  #
  # In the case that only `name` needs to be specified, then you can provide a raw string wherever
  # `ServiceDesignator` is needed. Cap'n proto automatically assumes the string is intended to be
  # the value for `name`, since that is the first field. In other words, if you would otherwise
  # write something like:
  #
  #     bindings = [(service = (name = "foo"))]
  #
  # You can write this instead, which is equivalent:
  #
  #     bindings = [(service = "foo")]

  name @0 :Text;
  # Name of the service in the Config.services list.

  entrypoint @1 :Text;
  # A modules-syntax Worker can export multiple named entrypoints. `export default {` specifies
  # the default entrypoint, whereas `export let foo = {` defines an entrypoint named `foo`. If
  # `entrypoint` is specified here, it names an alternate entrypoint to use on the target worker,
  # otherwise the default is used.

  props :union {
    # Value to provide in `ctx.props` in the target worker.

    empty @2 :Void;
    # Empty object. (This is the default.)

    json @3 :Text;
    # A JSON-encoded value.
  }

  # TODO(someday): Options to specify which event types are allowed.
  # TODO(someday): Allow adding an outgoing middleware stack here (see TODO in Service, above).
}

struct Worker {
  union {
    modules @0 :List(Module);
    # The Worker is composed of ES modules that may import each other. The first module in the list
    # is the main module, which exports event handlers.

    serviceWorkerScript @1 :Text;
    # The Worker is composed of one big script that uses global `addEventListener()` to register
    # event handlers.
    #
    # The value of this field is the raw source code. When using Cap'n Proto text format, use the
    # `embed` directive to read the code from an external file:
    #
    #     serviceWorkerScript = embed "worker.js"

    inherit @2 :Text;
    # Inherit the configuration of some other Worker by its service name. This Worker is a clone
    # of the other worker, but various settings can be modified:
    # * `bindings`, if specified, overrides specific named bindings. (Each binding listed in the
    #   derived worker must match the name and type of some binding in the inherited worker.)
    # * `globalOutbound`, if non-null, overrides the one specified in the inherited worker.
    # * `compatibilityDate` and `compatibilityFlags` CANNOT be modified; they must be null.
    # * If the inherited worker defines durable object namespaces, then the derived worker must
    #   specify `durableObjectStorage` to specify where its instances should be stored. Each
    #   devived worker receives its own namespace of objects. `durableObjectUniqueKeyModifier`
    #   must also be specified by derived workers.
    #
    # This can be useful when you want to run the same Worker in multiple configurations or hooked
    # up to different back-ends. Note that all derived workers run in the same isolate as the
    # base worker; they differ in the content of the `env` object passed to them, which contains
    # the bindings. (When using service workers syntax, the global scope contains the bindings;
    # in this case each derived worker runs in its own global scope, though still in the same
    # isolate.)
  }

  struct Module {
    name @0 :Text;
    # Name (or path) used to import the module.

    union {
      esModule @1 :Text;
      # An ES module file with imports and exports.
      #
      # As with `serviceWorkerScript`, above, the value is the raw source code.

      commonJsModule @2 :Text;
      # A common JS module, using require().

      text @3 :Text;
      # A raw text blob. Importing this will produce a string with the value.

      data @4 :Data;
      # A raw data blob. Importing this will produce an ArrayBuffer with the value.

      wasm @5 :Data;
      # A Wasm module. The value is a compiled binary Wasm module file. Importing this will produce
      # a `WebAssembly.Module` object, which you can then instantiate.

      json @6 :Text;
      # Importing this will produce the result of parsing the given text as JSON.

      obsolete @7 :Text;
      # This position used to be the nodeJsCompatModule type that has now been
      # obsoleted.

      pythonModule @8 :Text;
      # A Python module. All bundles containing this value type are converted into a JS/WASM Worker
      # Bundle prior to execution.

      pythonRequirement @9 :Text;
      # A Python package that is required by this bundle. The package must be supported by
      # Pyodide (https://pyodide.org/en/stable/usage/packages-in-pyodide.html). All packages listed
      # will be installed prior to the execution of the worker.
      #
      # The value of this field is ignored and should always be an empty string. Only the module
      # name matters. The field should have been declared `Void`, but it's difficult to change now.
    }

    namedExports @10 :List(Text);
    # For commonJsModule modules, this is a list of named exports that the
    # module expects to be exported once the evaluation is complete.
    #
    # (`commonJsModule` should have been a group containing the body and `namedExports`, but it's
    # too late to change now.)
  }

  compatibilityDate @3 :Text;
  compatibilityFlags @4 :List(Text);
  # See: https://developers.cloudflare.com/workers/platform/compatibility-dates/
  #
  # `compatibilityDate` must be specified, unless the Worker inhits from another worker, in which
  # case it must not be specified. `compatibilityFlags` can optionally be specified when
  # `compatibilityDate` is specified.

  bindings @5 :List(Binding);
  # List of bindings, which give the Worker access to external resources and configuration
  # settings.
  #
  # For Workers using ES modules syntax, the bindings are delivered via the `env` object. For
  # service workers syntax, each binding shows up as a global variable.

  struct Binding {
    name @0 :Text;

    union {
      unspecified @1 :Void;
      # (This catches when someone forgets to specify one of the union members. Do not set this.)

      parameter :group {
        # Indicates that the Worker requires a binding of the given type, but it won't be specified
        # here. Another Worker can inherit this Worker and fill in this binding.

        type @2 :Type;
        # Expected type of this parameter.

        optional @3 :Bool;
        # If true, this binding is optional. Derived workers need not specify it, in which case
        # the binding won't be present in the environment object passed to the worker.
        #
        # When a Worker has any non-optional parameters that haven't been filled in, then it can
        # only be used for inheritance; it cannot be invoked directly.
      }

      text @4 :Text;
      # A string.

      data @5 :Data;
      # An ArrayBuffer.

      json @6 :Text;
      # A value parsed from JSON.

      wasmModule @7 :Data;
      # A WebAssembly module. The binding will be an instance of `WebAssembly.Module`. Only
      # supported when using Service Workers syntax.
      #
      # DEPRECATED: Please switch to ES modules syntax instead, and embed Wasm modules as modules.

      cryptoKey @8 :CryptoKey;
      # A CryptoKey instance, for use with the WebCrypto API.
      #
      # Note that by setting `extractable = false`, you can prevent the Worker code from accessing
      # or leaking the raw key material; it will only be able to use the key to perform WebCrypto
      # operations.

      service @9 :ServiceDesignator;
      # Binding to a named service (possibly, a worker).

      durableObjectClass @26 :ServiceDesignator;
      # A Durable Object class binding, without an actual storage namespace. This can be used to
      # implement a facet.

      durableObjectNamespace @10 :DurableObjectNamespaceDesignator;
      # Binding to the durable object namespace implemented by the given class.
      #
      # In the common case that this refers to a class in the same Worker, you can specify just
      # a string, like:
      #
      #     durableObjectNamespace = "MyClass"

      kvNamespace @11 :ServiceDesignator;
      # A KV namespace, implemented by the named service. The Worker sees a KvNamespace-typed
      # binding. Requests to the namespace will be converted into HTTP requests targeting the
      # given service name.

      r2Bucket @12 :ServiceDesignator;
      r2Admin @13 :ServiceDesignator;
      # R2 bucket and admin API bindings. Similar to KV namespaces, these turn operations into
      # HTTP requests aimed at the named service.

      wrapped @14 :WrappedBinding;
      # Wraps a collection of inner bindings in a common api functionality.

      queue @15 :ServiceDesignator;
      # A Queue binding, implemented by the named service. Requests to the
      # namespace will be converted into HTTP requests targeting the given
      # service name.

      fromEnvironment @16 :Text;
      # Takes the value of an environment variable from the system. The value specified here is
      # the name of a system environment variable. The value of the binding is obtained by invoking
      # `getenv()` with that name. If the environment variable isn't set, the binding value is
      # `null`.

      analyticsEngine @17 :ServiceDesignator;
      # A binding for Analytics Engine. Allows workers to store information through Analytics Engine Events.
      # workerd will forward AnalyticsEngineEvents to designated service in the body of HTTP requests
      # This binding is subject to change and requires the `--experimental` flag

      hyperdrive :group {
        designator @18 :ServiceDesignator;
        database @19 :Text;
        user @20 :Text;
        password @21 :Text;
        scheme @22 :Text;
      }
      # A binding for Hyperdrive. Allows workers to use Hyperdrive caching & pooling for Postgres
      # databases.

      unsafeEval @23 :Void;
      # A simple binding that enables access to the UnsafeEval API.

      memoryCache :group {
        # A binding representing access to an in-memory cache.

        id @24 :Text;
        # The identifier associated with this cache. Any number of isolates
        # can access the same in-memory cache (within the same process), and
        # each worker may use any number of in-memory caches.

        limits @25 :MemoryCacheLimits;
      }

      workerLoader :group {
        # A binding representing the ability to dynamically load Workers from code presented at
        # runtime.
        #
        # A Worker loader is not just a function that loads a Worker, but also serves as a
        # cache of Workers, automatically unloading Workers that are not in use. To that end, each
        # Worker must have a name, and if a Worker with that name already exists, it'll be reused.

        id @27 :Text;
        # Optional: The identifier associated with this Worker loader. Multiple Workers can bind to
        # the same ID in order to access the same loader, so that if they request the same name
        # from it, they'll end up sharing the same loaded Worker.
        #
        # (If omitted, the binding will not share a cache with any other binding.)
      }

      # TODO(someday): dispatch, other new features
    }

    struct Type {
      # Specifies the type of a parameter binding.

      union {
        unspecified @0 :Void;
        # (This catches when someone forgets to specify one of the union members. Do not set this.)

        text @1 :Void;
        data @2 :Void;
        json @3 :Void;
        wasm @4 :Void;
        cryptoKey @5 :List(CryptoKey.Usage);
        service @6 :Void;
        durableObjectNamespace @7 :Void;
        kvNamespace @8 :Void;
        r2Bucket @9 :Void;
        r2Admin @10 :Void;
        queue @11 :Void;
        analyticsEngine @12 : Void;
        hyperdrive @13: Void;
        durableObjectClass @14: Void;
      }
    }

    struct DurableObjectNamespaceDesignator {
      # The type of a Durable Object namespace binding.

      className @0 :Text;
      # Exported class name that implements the Durable Object.

      serviceName @1 :Text;
      # The service name of the worker that defines this class. If omitted, the current worker
      # is assumed.
      #
      # Use of this field is discouraged. Instead, when accessing a different Worker's Durable
      # Objects, specify a `service` binding to that worker, and have the worker implement an
      # appropriate API.
      #
      # (This is intentionally not a ServiceDesignator because you cannot choose an alternate
      # entrypoint here; the class name IS the entrypoint.)
    }

    struct CryptoKey {
      # Parameters to crypto.subtle.importKey().

      union {
        raw @0 :Data;
        hex @1 :Text;
        base64 @2 :Text;
        # Raw key material, possibly hex or base64-encoded. Use this for symmetric keys.
        #
        # Hint: `raw` would typically be used with Cap'n Proto's `embed` syntax to embed an
        # external binary key file. `hex` or `base64` could do that too but can also be specified
        # inline.

        pkcs8 @3 :Text;
        # Private key in PEM-encoded PKCS#8 format.

        spki @4 :Text;
        # Public key in PEM-encoded SPKI format.

        jwk @5 :Text;
        # Key in JSON format.
      }

      algorithm :union {
        # Value for the `algorithm` parameter.

        name @6 :Text;
        # Just a name, like `AES-GCM`.

        json @7 :Text;
        # An object, encoded here as JSON.
      }

      extractable @8 :Bool = false;
      # Is the Worker allowed to export this key to obtain the underlying key material? Setting
      # this false ensures that the key cannot be leaked by errant JavaScript code; the key can
      # only be used in WebCrypto operations.

      usages @9 :List(Usage);
      # What operations is this key permitted to be used for?

      enum Usage {
        encrypt @0;
        decrypt @1;
        sign @2;
        verify @3;
        deriveKey @4;
        deriveBits @5;
        wrapKey @6;
        unwrapKey @7;
      }
    }

    struct MemoryCacheLimits {
      maxKeys @0 :UInt32;
      maxValueSize @1 :UInt32;
      maxTotalValueSize @2 :UInt64;
    }

    struct WrappedBinding {
      # A binding that wraps a group of (lower-level) bindings in a common API.

      moduleName @0 :Text;
      # Wrapper module name.
      # The module must be an internal one (provided by extension or registered in the c++ code).
      # Module will be instantitated during binding initialization phase.

      entrypoint @1 :Text = "default";
      # Module needs to export a function with a given name (default export gets "default" name).
      # The function needs to accept a single `env` argument - a dictionary with inner bindings.
      # Function will be invoked during initialization phase and its return value will be used as
      # resulting binding value.

      innerBindings @2 :List(Binding);
      # Inner bindings that will be created and passed in the env dictionary.
      # These bindings shall be used to implement end-user api, and are not available to the
      # binding consumers unless "re-exported" in wrapBindings function.
    }
  }

  globalOutbound @6 :ServiceDesignator = "internet";
  # Where should the global "fetch" go to? The default is the service called "internet", which
  # should usually be configured to talk to the public internet.

  cacheApiOutbound @11 :ServiceDesignator;
  # Where should cache API (i.e. caches.default and caches.open(...)) requests go?

  durableObjectNamespaces @7 :List(DurableObjectNamespace);
  # List of durable object namespaces in this Worker.

  struct DurableObjectNamespace {
    className @0 :Text;
    # Exported class name that implements the Durable Object.
    #
    # Changing the class name will not break compatibility with existing storage, so long as
    # `uniqueKey` stays the same.

    union {
      uniqueKey @1 :Text;
      # A unique, stable ID associated with this namespace. This could be a  GUID, or any other
      # string which does not appear anywhere else in the world.
      #
      # This string is used to ensure that objects of this class have unique identifiers distinct
      # from objects of any other class. Object IDs are cryptographically derived from `uniqueKey`
      # and validated against it. It is impossible to guess or forge a valid object ID without
      # knowing the `uniqueKey`. Hence, if you keep the key secret, you can prevent anyone from
      # forging IDs. However, if you don't care if users can forge valid IDs, then it's not a big
      # deal if the key leaks.
      #
      # DO NOT LOSE this key, otherwise it may be difficult or impossible to recover stored data.

      ephemeralLocal @2 :Void;
      # Instances of this class are ephemeral -- they have no durable storage at all. The
      # `state.storage` API will not be present. Additionally, this namespace will allow arbitrary
      # strings as IDs. There are no `idFromName()` nor `newUniqueId()` methods; `get()` takes any
      # string as a parameter.
      #
      # Ephemeral objects are NOT globally unique, only "locally" unique, for some definition of
      # "local". For example, on Cloudflare's network, these objects are unique per-colo.
      #
      # WARNING: Cloudflare Workers currently limits this feature to Cloudflare-internal users
      #   only, because using them correctly requires deep understanding of Cloudflare network
      #   topology. We're working on something better for public consuption. Until then for
      #   "ephemeral" use cases we recommend using regular durable objects and just not storing
      #   anything. An object that hasn't stored anything will not consume any storage space on
      #   disk.
    }

    preventEviction @3 :Bool;
    # By default, Durable Objects are evicted after 10 seconds of inactivity, and expire 70 seconds
    # after all clients have disconnected. Some applications may want to keep their Durable Objects
    # pinned to memory forever, so we provide this flag to change the default behavior.
    #
    # Note that this is only supported in Workerd; production Durable Objects cannot toggle eviction.

    enableSql @4 :Bool;
    # Whether or not Durable Objects in this namespace can use the `storage.sql` API to execute SQL
    # queries.
    #
    # workerd uses SQLite to back all Durable Objects, but the SQL API is hidden by default to
    # emulate behavior of traditional DO namespaces on Cloudflare that aren't SQLite-backed. This
    # flag should be enabled when testing code that will run on a SQLite-backed namespace.

    container @5 :ContainerOptions;
    # If present, Durable Objects in this namespace have attached containers.
    # workerd will talk to the configured container engine to start containers for each
    # Durable Object based on the given image. The Durable Object can access the container via the
    # ctx.container API. TODO(CloudChamber): add link to docs.

    struct ContainerOptions {
      imageName @0 :Text;
      # Image name to be used to create the container using supported provider.
      # By default, we pull the "latest" tag of this image.
    }
  }

  durableObjectUniqueKeyModifier @8 :Text;
  # Additional text which is hashed together with `DurableObjectNamespace.uniqueKey`. When using
  # worker inheritance, each derived worker must specify a unique modifier to ensure that its
  # Durable Object instances have unique IDs from all other workers inheriting the same parent.
  #
  # DO NOT LOSE this value, otherwise it may be difficult or impossible to recover stored data.

  durableObjectStorage :union {
    # Specifies where this worker's Durable Objects are stored.

    none @9 :Void;
    # Default. The worker has no Durable Objects. `durableObjectNamespaces` must be empty, or
    # define all namespaces as `ephemeralLocal`, or this must be an abstract worker (meant to be
    # inherited by other workers, who will specify `durableObjectStorage`).

    inMemory @10 :Void;
    # The `state.storage` API stores in-memory only. All stored data will persist for the
    # lifetime of the process, but will be lost upon process exit.
    #
    # Individual objects will still shut down when idle as normal -- only data stored with the
    # `state.storage` interface is persistent for the lifetime of the process.
    #
    # This mode is intended for local testing purposes.

    localDisk @12 :Text;
    # ** EXPERIMENTAL; SUBJECT TO BACKWARDS-INCOMPATIBLE CHANGE **
    #
    # Durable Object data will be stored in a directory on local disk. This field is the name of
    # a service, which must be a DiskDirectory service. For each Durable Object class, a
    # subdirectory will be created using `uniqueKey` as the name. Within the directory, one or
    # more files are created for each object, with names `<id>.<ext>`, where `.<ext>` may be any of
    # a number of different extensions depending on the storage mode. (Currently, the main storage
    # is a file with the extension `.sqlite`, and in certain situations extra files with the
    # extensions `.sqlite-wal`, and `.sqlite-shm` may also be present.)
  }

  # TODO(someday): Support distributing objects across a cluster. At present, objects are always
  #   local to one instance of the runtime.

  moduleFallback @13 :Text;

  tails @14 :List(ServiceDesignator);
  # List of tail worker services that should receive tail events for this worker.
  # See: https://developers.cloudflare.com/workers/observability/logs/tail-workers/

  streamingTails @15 :List(ServiceDesignator);
  # List of streaming tail worker services that should receive tail events for this worker.
  # NOTE: This will be deleted in a future refactor, do not depend on this.

  containerEngine :union {
    none @16 :Void;
    # No container engine configured. Container operations will not be available.

    localDocker @17 :DockerConfiguration;
    # Use local Docker daemon for container operations.
    # Only used for local development and testing purposes.
  }

  struct DockerConfiguration {
    socketPath @0 :Text;
    # Path to the Docker socket.
  }
}

struct ExternalServer {
  # Describes the ability to talk to a specific server, typically a back-end server available
  # on the internal network.
  #
  # When a Worker contains a service binding that points to an ExternalServer, *all* fetch()
  # calls on that binding will be delivered to that server, regardless of whether the hostname
  # or protocol specified in the URL actually match the hostname or protocol used by the actual
  # server. Typically, a Worker implementing a reverse proxy would use this to forward a request
  # to a back-end application server. Such a back-end typically does not have a real public
  # hostname, since it is only reachable through the proxy, but the requests forwarded to it will
  # keep the hostname that was on the original request.
  #
  # Note that this also implies that regardless of whether the original URL was http: or https:,
  # the request will be delivered to the target server using the protocol specified below. A
  # header like `X-Forwarded-Proto` can be used to pass along the original protocol; see
  # `HttpOptions`.

  address @0 :Text;
  # Address/port of the server. Optional; if not specified, then you will be required to specify
  # the address on the command line with with `--external-addr <name>=<addr>`.
  #
  # Examples:
  # - "1.2.3.4": Connect to the given IPv4 address on the protocol's default port.
  # - "1.2.3.4:80": Connect to the given IPv4 address and port.
  # - "1234:5678::abcd": Connect to the given IPv6 address on the protocol's default port.
  # - "[1234:5678::abcd]:80": Connect to the given IPv6 address and port.
  # - "unix:/path/to/socket": Connect to the given Unix Domain socket by path.
  # - "unix-abstract:name": On Linux, connect to the given "abstract" Unix socket name.
  # - "example.com:80": Perform a DNS lookup to determine the address, and then connect to it.
  #
  # (These are the formats supported by KJ's parseAddress().)

  union {
    http @1 :HttpOptions;
    # Talk to the server over unencrypted HTTP.

    https :group {
      # Talk to the server over encrypted HTTPS.

      options @2 :HttpOptions;
      tlsOptions @3 :TlsOptions;

      certificateHost @4 :Text;
      # If present, expect the host to present a certificate authenticating it as this hostname.
      # If `certificateHost` is not provided, then the certificate is checked against `address`.
    }

    tcp :group {
      # Connect to the server over raw TCP. Bindings to this service will only support the
      # `connect()` method; `fetch()` will throw an exception.
      tlsOptions @5 :TlsOptions;
      certificateHost @6 :Text;
    }

    # TODO(someday): Cap'n Proto RPC
  }
}

struct Network {
  # Describes the ability to talk to a network.
  #
  # This is commonly used to define the "internet" service which is the default `globalOutbound`
  # for all Workers. To prevent SSRF, by default Workers will not be permitted to reach internal
  # network addresses using global fetch(). It's recommended that you create ExternalServer
  # bindings instead to grant access to specific servers. However, if you really want to, you
  # can configure a service that grants arbitrary internal network access, like:
  #
  #     ( name = "internalNetwork",
  #       network = (
  #         allow = ["public", "private"],
  #       )
  #     )

  allow @0 :List(Text) = ["public"];
  deny @1 :List(Text);
  # Specifies which network addresses the Worker will be allowed to connect to, e.g. using fetch().
  # The default allows publicly-routable IP addresses only, in order to prevent SSRF attacks.
  #
  # The allow and deny lists specify network blocks in CIDR notation (IPv4 and IPv6), such as
  # "192.0.2.0/24" or "2001:db8::/32". Traffic will be permitted as long as the address
  # matches at least one entry in the allow list and none in the deny list.
  #
  # In addition to IPv4 and IPv6 CIDR notation, several special strings may be specified:
  # - "private": Matches network addresses that are reserved by standards for private networks,
  #   such as "10.0.0.0/8" or "192.168.0.0/16". This is a superset of "local".
  # - "public": Opposite of "private".
  # - "local": Matches network addresses that are defined by standards to only be accessible from
  #   the local machine, such as "127.0.0.0/8" or Unix domain addresses.
  # - "network": Opposite of "local".
  # - "unix": Matches all Unix domain socket addresses. (In the future, we may support specifying a
  #   glob to narrow this to specific paths.)
  # - "unix-abstract": Matches Linux's "abstract unix domain" addresses. (In the future, we may
  #   support specifying a glob.)
  #
  # In the case that the Worker specifies a DNS hostname rather than a raw address, these rules are
  # used to filter the addresses returned by the lookup. If none of the returned addresses turn
  # out to be permitted, then the system will behave as if the DNS entry did not exist.
  #
  # (The above is exactly the format supported by kj::Network::restrictPeers().)

  tlsOptions @2 :TlsOptions;
}

struct DiskDirectory {
  # Configures access to a directory on disk. This is a type of service which will expose an HTTP
  # interface to the directory content.
  #
  # This is very bare-bones, generally not suitable for serving a web site on its own. In
  # particular, no attempt is made to guess the `Content-Type` header. You normally would wrap
  # this in a Worker that fills in the metadata in the way you want.
  #
  # A GET request targeting a directory (rather than a file) will return a basic JSAN directory
  # listing like:
  #
  #     [{"name":"foo","type":"file"},{"name":"bar","type":"directory"}]
  #
  # Possible "type" values are "file", "directory", "symlink", "blockDevice", "characterDevice",
  # "namedPipe", "socket", "other".
  #
  # `Content-Type` will be `application/octet-stream` for files or `application/json` for a
  # directory listing. Files will have a `Content-Length` header, directories will not. Symlinks
  # will be followed (but there is intentionally no way to create one, even if `writable` is
  # `true`), and treated according to the type of file they point to. The other inode types cannot
  # be opened; trying to do so will produce a "406 Not Acceptable" error (on the theory that there
  # is no acceptable format for these, regardless of what the client says it accepts).
  #
  # `HEAD` requests are properly optimized to perform a stat() without actually opening the file.

  path @0 :Text;
  # The filesystem path of the directory. If not specified, then it must be specified on the
  # command line with `--directory-path <service-name>=<path>`.
  #
  # Relative paths are interpreted relative to the current directory where the server is executed,
  # NOT relative to the config file. So, you should usually use absolute paths in the config file.

  writable @1 :Bool = false;
  # Whether to support PUT requests for writing. A PUT will write to a temporary file which
  # is atomically moved into place upon successful completion of the upload. Parent directories are
  # created as needed.

  allowDotfiles @2 :Bool = false;
  # Whether to allow access to files and directories whose name starts with '.'. These are made
  # inaccessible by default since they very often store metadata that is not meant to be served,
  # e.g. a git repository or an `.htaccess` file.
  #
  # Note that the special links "." and ".." will never be accessible regardless of this setting.
}

# ========================================================================================
# Protocol options

struct HttpOptions {
  # Options for using HTTP (as a client or server). In particular, this specifies behavior that is
  # important in the presence of proxy servers, whether forward or reverse.

  style @0 :Style = host;

  enum Style {
    host @0;
    # Normal HTTP. The request line contains only the path, and the separate `Host` header
    # specifies the hostname.

    proxy @1;
    # HTTP proxy protocol. The request line contains a full URL instead of a path. No `Host`
    # header is required. This is the protocol used by HTTP forward proxies. This allows you to
    # implement such a proxy as a Worker.
  }

  forwardedProtoHeader @1 :Text;
  # If specified, then when the given header is present on a request, it specifies the protocol
  # ("http" or "https") that was used by the original client. The request URL reported to the
  # Worker will reflect this protocol. Otherwise, the URL will reflect the actual physical protocol
  # used by the server in receiving the request.
  #
  # This option is useful when this server sits behind a reverse proxy that performs TLS
  # termination. Typically such proxies forward the original protocol in a header named something
  # like "X-Forwarded-Proto".
  #
  # This setting is ignored when `style` is `proxy`.

  cfBlobHeader @2 :Text;
  # If set, then the `request.cf` object will be encoded (as JSON) into / parsed from the header
  # with this name. Otherwise, it will be discarded on send / `undefined` on receipt.

  injectRequestHeaders @3 :List(Header);
  # List of headers which will be automatically injected into all requests. This can be used
  # e.g. to add an authorization token to all requests when using `ExternalServer`. It can also
  # apply to incoming requests received on a `Socket` to modify the headers that will be delivered
  # to the app. Any existing header with the same name is removed.

  injectResponseHeaders @4 :List(Header);
  # Same as `injectRequestHeaders` but for responses.

  struct Header {
    name @0 :Text;
    # Case-insensitive.

    value @1 :Text;
    # If null, the header will be removed.
  }

  capnpConnectHost @5 :Text;
  # A CONNECT request for this host+port will be treated as a request to form a Cap'n Proto RPC
  # connection. The server will expose a WorkerdBootstrap as the bootstrap interface, allowing
  # events to be delivered to the target worker via capnp. Clients will use capnp for non-HTTP
  # event types (especially JSRPC).

  # TODO(someday): When we support TCP, include an option to deliver CONNECT requests to the
  #   TCP handler.
}

struct TlsOptions {
  # Options that apply when using TLS. Can apply on either the client or the server side, depending
  # on the context.
  #
  # This is based on KJ's TlsContext::Options.

  keypair @0 :Keypair;
  # The default private key and certificate to use. Optional when acting as a client.

  struct Keypair {
    privateKey @0 :Text;
    # Private key in PEM format. Supports PKCS8 keys as well as "traditional format" RSA and DSA
    # keys.
    #
    # Remember that you can use Cap'n Proto's `embed` syntax to reference an external file.

    certificateChain @1 :Text;
    # Certificate chain in PEM format. A chain can be constructed by concatenating multiple
    # PEM-encoded certificates, starting with the leaf certificate.
  }

  # TODO(someday): Support SNI-based keypair selection? Is a hostname -> keypair map good enough?
  #   Does it need to support wildcards? Maybe we should just let you provide a pile of certs and
  #   we can figure out which hosts each one matches?

  requireClientCerts @1 :Bool = false;
  # If true, then when acting as a server, incoming connections will be rejected unless they bear
  # a certificate signed by one of the trusted CAs.
  #
  # Typically, when using this, you'd set `trustBrowserCas = false` and list a specific private CA
  # in `trustedCertificates`.

  trustBrowserCas @2 :Bool = false;
  # If true, trust certificates which are signed by one of the CAs that browsers normally trust.
  # You should typically set this true when talking to the public internet, but you may want to
  # set it false when talking to servers on your internal network.

  trustedCertificates @3 :List(Text);
  # Additional CA certificates to trust, in PEM format. Remember that you can use Cap'n Proto's
  # `embed` syntax to read the certificates from other files.

  minVersion @4 :Version = goodDefault;
  # Minimum TLS version that will be allowed. Generally you should not override this unless you
  # have unusual backwards-compatibility needs.

  enum Version {
    goodDefault @0;
    # A good default chosen by the code maintainers. May change over time.

    ssl3 @1;
    tls1Dot0 @2;
    tls1Dot1 @3;
    tls1Dot2 @4;
    tls1Dot3 @5;
  }

  cipherList @5 :Text;
  # OpenSSL cipher list string. The default is a curated list designed to be compatible with
  # almost all software in current use (specifically, based on Mozilla's "intermediate"
  # recommendations). The defaults will change in future versions of this software to account
  # for the latest cryptanalysis.
  #
  # Generally you should only specify your own `cipherList` if:
  # - You have extreme backwards-compatibility needs and wish to enable obsolete and/or broken
  #   algorithms.
  # - You need quickly to disable an algorithm recently discovered to be broken.
}

# ========================================================================================
# Extensions

struct Extension {
  # Additional capabilities for workers.

  modules @0 :List(Module);
  # List of javascript modules provided by the extension.
  # These modules can either be imported directly as user-level api (if not marked internal)
  # or used to define more complicated workerd constructs such as wrapped bindings and events.

  struct Module {
    # A module extending workerd functionality.

    name @0 :Text;
    # Full js module name.

    internal @1 :Bool = false;
    # Internal modules can be imported by other extension modules only and not the user code.

    esModule @2 :Text;
    # Raw source code of ES module.
  }
}

# ========================================================================================
# Fallback Service Request
#  Used only to define the JSON structure of a request to the fallback service.

struct FallbackServiceRequest {
  type @0 :Text;
  specifier @1 :Text;
  rawSpecifier @2 :Text;
  referrer @3 :Text;

  struct Attribute {
    name @0: Text;
    value @1: Text;
  }
  attributes @4 :List(Attribute);
}
