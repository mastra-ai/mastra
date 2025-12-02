/**
 * @license
 * Copyright 2017 Google LLC
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

/**
 * THIS FILE IS FOR INTERNAL USAGE ONLY, IF YOU ARE NOT DEVELOPING THE FIREBASE
 * SDKs, PLEASE DO NOT REFERENCE THIS FILE AS IT MAY CHANGE WITHOUT WARNING
 */

import { FirebaseApp, FirebaseNamespace } from '@firebase/app-types';
import { Observer, Subscribe } from '@firebase/util';
import { FirebaseError, ErrorFactory } from '@firebase/util';
import { Component, ComponentContainer, Name } from '@firebase/component';

export interface FirebaseServiceInternals {
  /**
   * Delete the service and free it's resources - called from
   * app.delete().
   */
  delete(): Promise<void>;
}

// Services are exposed through instances - each of which is associated with a
// FirebaseApp.
export interface FirebaseService {
  app: FirebaseApp;
  INTERNAL?: FirebaseServiceInternals;
}

export type AppHook = (event: string, app: FirebaseApp) => void;

/**
 * Firebase Services create instances given a Firebase App instance and can
 * optionally add properties and methods to each FirebaseApp via the extendApp()
 * function.
 */
export interface FirebaseServiceFactory {
  (
    app: FirebaseApp,
    extendApp?: (props: { [prop: string]: any }) => void,
    instanceString?: string
  ): FirebaseService;
}

export interface PlatformLoggerService {
  getPlatformInfoString(): string;
}

/**
 * All ServiceNamespaces extend from FirebaseServiceNamespace
 */
export interface FirebaseServiceNamespace<T extends FirebaseService> {
  (app?: FirebaseApp): T;
}

export interface FirebaseAuthTokenData {
  accessToken: string;
}

export interface FirebaseAppInternals {
  getToken(refreshToken?: boolean): Promise<FirebaseAuthTokenData | null>;
  getUid(): string | null;
  addAuthTokenListener(fn: (token: string | null) => void): void;
  removeAuthTokenListener(fn: (token: string | null) => void): void;
  analytics: {
    logEvent: (
      eventName: string,
      eventParams: { [key: string]: any },
      options?: { global: boolean }
    ) => void;
  };
}

export interface _FirebaseApp extends FirebaseApp {
  container: ComponentContainer;
  _addComponent<T extends Name>(component: Component<T>): void;
  _addOrOverwriteComponent<T extends Name>(component: Component<T>): void;
  _removeServiceInstance(name: string, instanceIdentifier?: string): void;
}
export interface _FirebaseNamespace extends FirebaseNamespace {
  INTERNAL: {
    /**
     * Internal API to register a Firebase Service into the firebase namespace.
     *
     * Each service will create a child namespace (firebase.<name>) which acts as
     * both a namespace for service specific properties, and also as a service
     * accessor function (firebase.<name>() or firebase.<name>(app)).
     *
     * @param name The Firebase Service being registered.
     * @param createService Factory function to create a service instance.
     * @param serviceProperties Properties to copy to the service's namespace.
     * @param appHook All appHooks called before initializeApp returns to caller.
     * @param allowMultipleInstances Whether the registered service supports
     *   multiple instances per app. If not specified, the default is false.
     */
    registerComponent<T extends Name>(
      component: Component<T>
    ): FirebaseServiceNamespace<FirebaseService> | null;

    /**
     * Just used for testing to start from a fresh namespace.
     */
    createFirebaseNamespace(): FirebaseNamespace;

    /**
     * Internal API to install properties on the top-level firebase namespace.
     * @prop props The top level properties of this object are copied to the
     *   namespace.
     */
    extendNamespace(props: { [prop: string]: any }): void;

    /**
     * Create a Subscribe function.  A proxy Observer is created so that
     * events can be sent to single Observer to be fanned out automatically.
     */
    createSubscribe<T>(
      executor: (observer: Observer<T>) => void,
      onNoObservers?: (observer: Observer<T>) => void
    ): Subscribe<T>;

    /**
     * Utility exposed for internal testing.
     */
    deepExtend(target: any, source: any): any;

    /**
     * Internal API to remove an app from the list of registered apps.
     */
    removeApp(name: string): void;

    /**
     * registered components.
     */
    components: Map<string, Component>;

    /*
     * Convert service name to factory name to use.
     */
    useAsService(app: FirebaseApp, serviceName: string): string | null;

    /**
     * Use to construct all thrown FirebaseError's.
     */
    ErrorFactory: typeof ErrorFactory;
  };
}

declare module '@firebase/component' {
  interface NameServiceMapping {
    'platform-logger': PlatformLoggerService;
  }
}
