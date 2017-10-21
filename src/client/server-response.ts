import { EventEmitter } from "events";
import { STATUS_CODES } from "statuses";
import * as T from "./_types";
import { IncomingMessage } from "./incoming-message";

export class ServerResponse extends EventEmitter {
  public socket: T.Socket;
  public connection: T.Socket;
  public statusCode: number;
  public statusMessage?: string;
  public sendDate: boolean;
  public finished: boolean;
  public headersSent: boolean;
  // @internal
  // tslint:disable-next-line
  public _body: T.Chunk[];
  // @internal
  // tslint:disable-next-line
  public _headers: T.Headers;

  /**
   * @description
   * Emulates nodes ServerResponse in the browser.
   * See: https://nodejs.org/api/http.html#http_class_http_serverresponse
   *
   * @param incomingMessage The incoming message that is tied to the response.
   */
  constructor(incomingMessage: IncomingMessage) {
    super();
    this.socket = this.connection = incomingMessage.socket;
    this.sendDate = true;
    this.finished = this.headersSent = false;
    this._body = [];
    this._headers = {};
  }

  /**
   * @description
   * This is a noop in the browser.
   */
  // tslint:disable-next-line
  writeContinue(): void {}

  /**
   * @description
   * This is a noop in the browser.
   */
  // tslint:disable-next-line
  setTimeout(): void {}

  /**
   * @description
   * This is a noop in the browser.
   */
  // tslint:disable-next-line
  addTrailers(): void {}

  /**
   * @description
   * Writes data to the current ServerResponse body.
   *
   * @example
   * res.write("Hello World")
   *
   * @param chunk A chunk to write to the server response.
   * @param encoding The encoding to use for the chunk (does nothing in browser).
   * @param onFinish A function called when the chunk has been written out.
   */
  public write(
    chunk: T.Chunk,
    encoding?: string | T.EmptyCallback,
    onFinish?: T.EmptyCallback
  ): void {
    this._body.push(chunk);

    if (typeof encoding === "function") {
      onFinish = encoding;
      encoding = undefined;
    }

    if (typeof onFinish === "function") {
      this.once("finish", onFinish);
    }
  }

  /**
   * @description
   * Write status, status message and headers to the current ServerResponse.
   *
   * @example
   * res.writeHead(200, "OK", { "Content-Type": "text/html" })
   *
   * @param statusCode The status code to write.
   * @param statusMessage The status message to write.
   * @param headers An object containing headers to write.
   */
  public writeHead(
    statusCode: number,
    statusMessage?: string | T.Headers,
    headers?: T.Headers
  ): void {
    if (this.headersSent) {
      return;
    }

    this.statusCode = statusCode;
    this.headersSent = true;

    if (statusMessage) {
      if (typeof statusMessage === "object") {
        headers = statusMessage;
      } else {
        this.statusMessage = statusMessage;
      }
    }

    if (typeof headers === "object") {
      for (const key in headers) {
        this.setHeader(key, headers[key] as string);
      }
    }
  }

  /**
   * @description
   * Get a shallow copy of all response header names.
   *
   * @example
   * res.getHeaders() // { "Content-Type": "...", ... }
   */
  public getHeaders(): T.Headers {
    return { ...this._headers };
  }

  /**
   * @description
   * Get a list of current header names.
   *
   * @example
   * res.getHeaderNames() // ["Content-Type", ...]
   */
  public getHeaderNames(): string[] {
    return Object.keys(this._headers);
  }

  /**
   * @description
   * Get a header from the current ServerResponse.
   *
   * @example
   * res.getHeader("Content-Type") // "text/html"
   *
   * @param header The name of the header to get.
   */
  public getHeader(header: string): string[] | string | void {
    return this._headers[header.toLowerCase()];
  }

  /**
   * @description
   * Check if a header has been set.
   *
   * @example
   * res.hasHeader("Content-Type") // true
   *
   * @param header The name of the header to check.
   */
  public hasHeader(header: string): boolean {
    return header.toLowerCase() in this._headers;
  }

  /**
   * @description
   * Remove a header from the current ServerResponse.
   *
   * @example
   * res.removeHeader("Content-Type")
   *
   * res.hasHeader("Content-Type") // false
   *
   * @param header The name of the header to remove.
   */
  public removeHeader(header: string): void {
    delete this._headers[header.toLowerCase()];
  }

  /**
   * @description
   * Write a header to the current ServerResponse.
   *
   * @example
   * res.setHeader("Content-Type", "text/html")
   *
   * res.hasHeader("Content-Type") // true
   *
   * @param header The name of the header to set.
   * @param value The value to set the header.
   */
  public setHeader(header: string, value: string | string[]): void {
    this._headers[header.toLowerCase()] = value;
  }

  /**
   * @description
   * Handle event ending from the current ServerResponse.
   *
   * @example
   * res.end("Hello World")
   *
   * @param chunk An option final chunk to write.
   * @param encoding The encoding for the optional chunk.
   * @param onFinish A function called when the response has been sent.
   */
  public end(
    chunk?: T.Chunk | T.EmptyCallback,
    encoding?: string | T.EmptyCallback,
    onFinish?: T.EmptyCallback
  ): void {
    if (this.finished) {
      return;
    }

    if (typeof chunk === "function") {
      onFinish = chunk;
      chunk = undefined;
    } else if (typeof encoding === "function") {
      onFinish = encoding;
      encoding = undefined;
    }

    if (chunk != null) {
      this._body.push(chunk as T.Chunk);
    }

    if (typeof onFinish === "function") {
      this.once("finish", onFinish);
    }

    if (this.statusCode == null) {
      this.statusCode = 200;
    }

    if (this.statusMessage == null) {
      this.statusMessage = STATUS_CODES[this.statusCode];
    }

    if (this.sendDate) {
      this._headers.date = new Date().toUTCString();
    }

    this._headers.status = String(this.statusCode);
    this.headersSent = true;
    this.finished = true;
    this.emit("finish");
  }
}

/**
 * @description
 * Creates a new server response and sets up some properties.
 *
 * @param incomingMessage The incomingMessage that is tied to this response.
 * @internal
 */
export function _createServerResponse(incomingMessage: IncomingMessage) {
  return new ServerResponse(incomingMessage);
}
