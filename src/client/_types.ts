import { Types as TypesURL } from "mini-url";
import { Server } from "./server";

export type URL = TypesURL.URL;
export type Chunk = Buffer | ArrayBuffer | string[] | string;
export type EmptyCallback = () => void;

export interface Socket {
  server: Server;
  remoteAddress: string;
  encrypted: boolean;
}

export interface Headers {
  referrer?: string | string[];
  referer?: string | string[];
  date?: string | string[];
  host?: string | string[];
  cookie?: string | string[];
  connection?: string | string[];
  accept?: string | string[];
  "user-agent"?: string | string[];
  "accept-language"?: string | string[];
  "cache-control"?: string | string[];
  [x: string]: string | string[] | undefined;
}

export interface FetchOptions {
  url?: string;
  method?: string;
  form?: HTMLFormElement;
  query?: any;
  body?: any;
  files?: any;
  scroll?: boolean;
  history?: boolean;
  redirect?: string;
  headers?: Headers;
  parsed?: URL;
}
