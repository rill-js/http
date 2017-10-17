import { EventEmitter } from "events";
import { IncomingMessage } from "./incoming-message";
import { ServerResponse } from "./server-response";

export class Server extends EventEmitter {
  public listening: boolean = false;

  /**
   * @description
   * Emulates node js http server in the browser.
   * See: https://nodejs.org/api/http.html#http_class_http_server
   *
   * @param onRequest An optional function called on each request.
   */
  constructor(
    onRequest?: (this: Server, req: IncomingMessage, res: ServerResponse) => any
  ) {
    super();
    if (onRequest) {
      this.on("request", onRequest);
    }
  }

  /**
   * @description
   * Starts a server and sets listening to true.
   * Adapters will hook into this to startup routers on individual platforms.
   *
   * @param onListening An optional function called once the server has started.
   */
  public listen(...args: any[]): this {
    // Automatically add callback `listen` handler.
    const onListening = args[args.length - 1];
    if (typeof onListening === "function") {
      this.once("listening", onListening);
    }

    // Ensure that listening is `async`.
    setTimeout(() => {
      // Mark server as listening.
      this.listening = true;
      this.emit("listening");
    }, 0);

    return this;
  }

  /**
   * @description
   * Closes the server and destroys all event listeners.
   *
   * @param onClode An option function called once the server stops.
   */
  public close(onClose?: (this: Server) => void) {
    // Automatically add callback `close` handler.
    if (typeof onClose === "function") {
      this.once("close", onClose);
    }

    // Ensure that closing is `async`.
    setTimeout(() => {
      // Mark server as closed.
      this.listening = false;
      this.emit("close");
    }, 0);

    return this;
  }

  /**
   * @description
   * This is a noop in the browser.
   */
  public unref(): Server {
    return this;
  }
}
