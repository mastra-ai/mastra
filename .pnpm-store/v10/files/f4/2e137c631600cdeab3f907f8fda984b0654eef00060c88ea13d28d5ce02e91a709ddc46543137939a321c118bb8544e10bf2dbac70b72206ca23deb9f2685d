import { Router } from "./router-DgnLO11b.js";
import { IncomingMessage, ServerResponse } from "node:http";

//#region src/adapters/node/request.d.ts
declare function getRequest({
  request,
  base,
  bodySizeLimit
}: {
  base: string;
  bodySizeLimit?: number;
  request: IncomingMessage;
}): Request;
declare function setResponse(res: ServerResponse, response: Response): Promise<void>;
//#endregion
//#region src/adapters/node/index.d.ts
declare function toNodeHandler(handler: Router["handler"]): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
//#endregion
export { getRequest, setResponse, toNodeHandler };
//# sourceMappingURL=node.d.ts.map