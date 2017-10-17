import { EventEmitter } from "events";
import * as T from "./_types";
import { Server } from "./server";

export class IncomingMessage extends EventEmitter {
  public connection: T.Socket;
  public httpVersionMajor: number;
  public httpVersionMinor: number;
  public httpVersion: string;
  public complete: boolean;
  public method: string;
  public url: string;
  public headers: T.Headers;
  // @internal
  // tslint:disable-next-line
  public _options: T.FetchOptions;

  /**
   * @description
   * Emulates nodes IncomingMessage in the browser.
   * See: https://nodejs.org/api/http.html#http_class_http_incomingmessage
   *
   * @param socket A mock net.Socket object.
   */
  constructor(public socket: T.Socket) {
    super();
    this.connection = this.socket;
    this.httpVersionMajor = 1;
    this.httpVersionMinor = 1;
    this.httpVersion = "1.1";
    this.complete = false;
    this.method = "GET";
    this.url = "";
  }
}

/**
 * @description
 * Creates a new incoming request and sets up some headers and other properties.
 *
 * @param server The @rill/http server to create the IncomingMessage for.
 * @param options Fetch style options to create the request.
 * @internal
 */
export function _createIncomingMessage(
  server: Server,
  options: T.FetchOptions
): IncomingMessage {
  const headers = options.headers;
  const parsed = options.parsed as T.URL;
  const incomingMessage = new IncomingMessage({
    encrypted: parsed.protocol === "https:",
    remoteAddress: "127.0.0.1",
    server
  });

  // Set default headers.
  const referrer = headers && (headers.referrer || headers.referer);
  incomingMessage.headers = {
    accept: "*/*",
    "accept-language": navigator.language,
    "cache-control": "max-age=0",
    connection: "keep-alive",
    cookie: document.cookie,
    date: new Date().toUTCString(),
    host: parsed.host,
    referer: referrer,
    referrer,
    "user-agent": navigator.userAgent,
    ...normalizeHeaders(headers)
  };

  // Setup other properties.
  incomingMessage.method = options.method
    ? options.method.toUpperCase()
    : "GET";
  incomingMessage._options = options;

  return incomingMessage;
}

/**
 * @description
 * Converts a headers object to a regular object.
 *
 * @param headers A headers object to normalize to a regular object.
 * @internal
 */
function normalizeHeaders(headers: any): T.Headers {
  if (headers == null || typeof headers.forEach !== "function") {
    return headers as T.Headers;
  }

  const result: T.Headers = {};
  headers.forEach((value: string | string[], header: string) => {
    result[header] = value;
  });

  return result;
}
