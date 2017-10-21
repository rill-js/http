import { STATUS_CODES } from "statuses";
import * as Types from "./_types";
import { IncomingMessage } from "./incoming-message";
import { Server } from "./server";
import { ServerResponse } from "./server-response";

export { STATUS_CODES, IncomingMessage, Server, ServerResponse, Types };

export const METHODS: string[] = [
  "OPTIONS",
  "HEAD",
  "GET",
  "PUT",
  "POST",
  "PATCH",
  "DELETE"
];

/**
 * @description
 * Creates a new mock http server in the browser.
 * Any arguments provided (besides the last one) are ignored in the browser.
 *
 * @param onRequest An optional function called on each request.
 */
export function createServer(
  onRequest?: (this: Server, req: IncomingMessage, res: ServerResponse) => any
): Server {
  return new Server(arguments[arguments.length - 1]);
}
