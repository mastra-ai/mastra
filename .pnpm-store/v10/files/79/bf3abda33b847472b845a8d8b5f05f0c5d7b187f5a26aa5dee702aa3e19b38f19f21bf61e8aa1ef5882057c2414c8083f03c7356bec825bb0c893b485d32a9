/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultNamespace = exports.FirebaseNamespace = exports.FirebaseNamespaceInternals = void 0;
const lifecycle_1 = require("./lifecycle");
const credential_factory_1 = require("./credential-factory");
const index_1 = require("../utils/index");
/**
 * Internals of a FirebaseNamespace instance.
 */
class FirebaseNamespaceInternals {
    constructor(appStore) {
        this.appStore = appStore;
    }
    /**
     * Initializes the App instance.
     *
     * @param options - Optional options for the App instance. If none present will try to initialize
     *   from the FIREBASE_CONFIG environment variable. If the environment variable contains a string
     *   that starts with '{' it will be parsed as JSON, otherwise it will be assumed to be pointing
     *   to a file.
     * @param appName - Optional name of the FirebaseApp instance.
     *
     * @returns A new App instance.
     */
    initializeApp(options, appName) {
        const app = this.appStore.initializeApp(options, appName);
        return extendApp(app);
    }
    /**
     * Returns the App instance with the provided name (or the default App instance
     * if no name is provided).
     *
     * @param appName - Optional name of the FirebaseApp instance to return.
     * @returns The App instance which has the provided name.
     */
    app(appName) {
        const app = this.appStore.getApp(appName);
        return extendApp(app);
    }
    /*
     * Returns an array of all the non-deleted App instances.
     */
    get apps() {
        return this.appStore.getApps().map((app) => extendApp(app));
    }
}
exports.FirebaseNamespaceInternals = FirebaseNamespaceInternals;
const firebaseCredential = {
    cert: credential_factory_1.cert, refreshToken: credential_factory_1.refreshToken, applicationDefault: credential_factory_1.applicationDefault
};
/**
 * Global Firebase context object.
 */
class FirebaseNamespace {
    /* tslint:enable */
    constructor(appStore) {
        // Hack to prevent Babel from modifying the object returned as the default admin namespace.
        /* tslint:disable:variable-name */
        this.__esModule = true;
        /* tslint:enable:variable-name */
        this.credential = firebaseCredential;
        this.SDK_VERSION = (0, index_1.getSdkVersion)();
        /* tslint:disable */
        // TODO(jwenger): Database is the only consumer of firebase.Promise. We should update it to use
        // use the native Promise and then remove this.
        this.Promise = Promise;
        this.INTERNAL = new FirebaseNamespaceInternals(appStore ?? new lifecycle_1.AppStore());
    }
    /**
     * Gets the `Auth` service namespace. The returned namespace can be used to get the
     * `Auth` service for the default app or an explicitly specified app.
     */
    get auth() {
        const fn = (app) => {
            return this.ensureApp(app).auth();
        };
        const auth = require('../auth/auth').Auth;
        return Object.assign(fn, { Auth: auth });
    }
    /**
     * Gets the `Database` service namespace. The returned namespace can be used to get the
     * `Database` service for the default app or an explicitly specified app.
     */
    get database() {
        const fn = (app) => {
            return this.ensureApp(app).database();
        };
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return Object.assign(fn, require('@firebase/database-compat/standalone'));
    }
    /**
     * Gets the `Messaging` service namespace. The returned namespace can be used to get the
     * `Messaging` service for the default app or an explicitly specified app.
     */
    get messaging() {
        const fn = (app) => {
            return this.ensureApp(app).messaging();
        };
        const messaging = require('../messaging/messaging').Messaging;
        return Object.assign(fn, { Messaging: messaging });
    }
    /**
     * Gets the `Storage` service namespace. The returned namespace can be used to get the
     * `Storage` service for the default app or an explicitly specified app.
     */
    get storage() {
        const fn = (app) => {
            return this.ensureApp(app).storage();
        };
        const storage = require('../storage/storage').Storage;
        return Object.assign(fn, { Storage: storage });
    }
    /**
     * Gets the `Firestore` service namespace. The returned namespace can be used to get the
     * `Firestore` service for the default app or an explicitly specified app.
     */
    get firestore() {
        let fn = (app) => {
            return this.ensureApp(app).firestore();
        };
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const firestore = require('@google-cloud/firestore');
        fn = Object.assign(fn, firestore.Firestore);
        // `v1beta1` and `v1` are lazy-loaded in the Firestore SDK. We use the same trick here
        // to avoid triggering this lazy-loading upon initialization.
        Object.defineProperty(fn, 'v1beta1', {
            get: () => {
                return firestore.v1beta1;
            },
        });
        Object.defineProperty(fn, 'v1', {
            get: () => {
                return firestore.v1;
            },
        });
        return fn;
    }
    /**
     * Gets the `MachineLearning` service namespace. The returned namespace can be
     * used to get the `MachineLearning` service for the default app or an
     * explicityly specified app.
     */
    get machineLearning() {
        const fn = (app) => {
            return this.ensureApp(app).machineLearning();
        };
        const machineLearning = require('../machine-learning/machine-learning').MachineLearning;
        return Object.assign(fn, { MachineLearning: machineLearning });
    }
    /**
     * Gets the `Installations` service namespace. The returned namespace can be used to get the
     * `Installations` service for the default app or an explicitly specified app.
     */
    get installations() {
        const fn = (app) => {
            return this.ensureApp(app).installations();
        };
        const installations = require('../installations/installations').Installations;
        return Object.assign(fn, { Installations: installations });
    }
    /**
     * Gets the `InstanceId` service namespace. The returned namespace can be used to get the
     * `Instance` service for the default app or an explicitly specified app.
     */
    get instanceId() {
        const fn = (app) => {
            return this.ensureApp(app).instanceId();
        };
        const instanceId = require('../instance-id/instance-id').InstanceId;
        return Object.assign(fn, { InstanceId: instanceId });
    }
    /**
     * Gets the `ProjectManagement` service namespace. The returned namespace can be used to get the
     * `ProjectManagement` service for the default app or an explicitly specified app.
     */
    get projectManagement() {
        const fn = (app) => {
            return this.ensureApp(app).projectManagement();
        };
        const projectManagement = require('../project-management/project-management').ProjectManagement;
        return Object.assign(fn, { ProjectManagement: projectManagement });
    }
    /**
     * Gets the `SecurityRules` service namespace. The returned namespace can be used to get the
     * `SecurityRules` service for the default app or an explicitly specified app.
     */
    get securityRules() {
        const fn = (app) => {
            return this.ensureApp(app).securityRules();
        };
        const securityRules = require('../security-rules/security-rules').SecurityRules;
        return Object.assign(fn, { SecurityRules: securityRules });
    }
    /**
     * Gets the `RemoteConfig` service namespace. The returned namespace can be used to get the
     * `RemoteConfig` service for the default app or an explicitly specified app.
     */
    get remoteConfig() {
        const fn = (app) => {
            return this.ensureApp(app).remoteConfig();
        };
        const remoteConfig = require('../remote-config/remote-config').RemoteConfig;
        return Object.assign(fn, { RemoteConfig: remoteConfig });
    }
    /**
     * Gets the `AppCheck` service namespace. The returned namespace can be used to get the
     * `AppCheck` service for the default app or an explicitly specified app.
     */
    get appCheck() {
        const fn = (app) => {
            return this.ensureApp(app).appCheck();
        };
        const appCheck = require('../app-check/app-check').AppCheck;
        return Object.assign(fn, { AppCheck: appCheck });
    }
    // TODO: Change the return types to app.App in the following methods.
    /**
     * Initializes the FirebaseApp instance.
     *
     * @param options - Optional options for the FirebaseApp instance.
     *   If none present will try to initialize from the FIREBASE_CONFIG environment variable.
     *   If the environment variable contains a string that starts with '{' it will be parsed as JSON,
     *   otherwise it will be assumed to be pointing to a file.
     * @param appName - Optional name of the FirebaseApp instance.
     *
     * @returns A new FirebaseApp instance.
     */
    initializeApp(options, appName) {
        return this.INTERNAL.initializeApp(options, appName);
    }
    /**
     * Returns the FirebaseApp instance with the provided name (or the default FirebaseApp instance
     * if no name is provided).
     *
     * @param appName - Optional name of the FirebaseApp instance to return.
     * @returns The FirebaseApp instance which has the provided name.
     */
    app(appName) {
        return this.INTERNAL.app(appName);
    }
    /*
     * Returns an array of all the non-deleted FirebaseApp instances.
     */
    get apps() {
        return this.INTERNAL.apps;
    }
    ensureApp(app) {
        if (typeof app === 'undefined') {
            app = this.app();
        }
        return app;
    }
}
exports.FirebaseNamespace = FirebaseNamespace;
/**
 * In order to maintain backward compatibility, we instantiate a default namespace instance in
 * this module, and delegate all app lifecycle operations to it. In a future implementation where
 * the old admin namespace is no longer supported, we should remove this.
 *
 * @internal
 */
exports.defaultNamespace = new FirebaseNamespace(lifecycle_1.defaultAppStore);
function extendApp(app) {
    const result = app;
    if (result.__extended) {
        return result;
    }
    result.auth = () => {
        const fn = require('../auth/index').getAuth;
        return fn(app);
    };
    result.appCheck = () => {
        const fn = require('../app-check/index').getAppCheck;
        return fn(app);
    };
    result.database = (url) => {
        const fn = require('../database/index').getDatabaseWithUrl;
        return fn(url, app);
    };
    result.messaging = () => {
        const fn = require('../messaging/index').getMessaging;
        return fn(app);
    };
    result.storage = () => {
        const fn = require('../storage/index').getStorage;
        return fn(app);
    };
    result.firestore = () => {
        const fn = require('../firestore/index').getFirestore;
        return fn(app);
    };
    result.instanceId = () => {
        const fn = require('../instance-id/index').getInstanceId;
        return fn(app);
    };
    result.installations = () => {
        const fn = require('../installations/index').getInstallations;
        return fn(app);
    };
    result.machineLearning = () => {
        const fn = require('../machine-learning/index').getMachineLearning;
        return fn(app);
    };
    result.projectManagement = () => {
        const fn = require('../project-management/index').getProjectManagement;
        return fn(app);
    };
    result.securityRules = () => {
        const fn = require('../security-rules/index').getSecurityRules;
        return fn(app);
    };
    result.remoteConfig = () => {
        const fn = require('../remote-config/index').getRemoteConfig;
        return fn(app);
    };
    result.__extended = true;
    return result;
}
