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
import { Node } from '../snap/Node';
import { ImmutableTree } from '../util/ImmutableTree';
import { Path } from '../util/Path';
import { Operation, OperationSource, OperationType } from './Operation';
export declare class Merge implements Operation {
    /** @inheritDoc */ source: OperationSource;
    /** @inheritDoc */ path: Path;
    /** @inheritDoc */ children: ImmutableTree<Node>;
    /** @inheritDoc */
    type: OperationType;
    constructor(
    /** @inheritDoc */ source: OperationSource, 
    /** @inheritDoc */ path: Path, 
    /** @inheritDoc */ children: ImmutableTree<Node>);
    operationForChild(childName: string): Operation;
    toString(): string;
}
