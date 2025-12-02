/**
 * @license
 * Copyright 2019 Google LLC
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
import { InstantiationMode, InstanceFactory, ComponentType, Dictionary, Name, onInstanceCreatedCallback } from './types';
/**
 * Component for service name T, e.g. `auth`, `auth-internal`
 */
export declare class Component<T extends Name = Name> {
    readonly name: T;
    readonly instanceFactory: InstanceFactory<T>;
    readonly type: ComponentType;
    multipleInstances: boolean;
    /**
     * Properties to be added to the service namespace
     */
    serviceProps: Dictionary;
    instantiationMode: InstantiationMode;
    onInstanceCreated: onInstanceCreatedCallback<T> | null;
    /**
     *
     * @param name The public service name, e.g. app, auth, firestore, database
     * @param instanceFactory Service factory responsible for creating the public interface
     * @param type whether the service provided by the component is public or private
     */
    constructor(name: T, instanceFactory: InstanceFactory<T>, type: ComponentType);
    setInstantiationMode(mode: InstantiationMode): this;
    setMultipleInstances(multipleInstances: boolean): this;
    setServiceProps(props: Dictionary): this;
    setInstanceCreatedCallback(callback: onInstanceCreatedCallback<T>): this;
}
