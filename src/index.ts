import type { SessionData } from "express-session";
import type { RPoolConnectionOptions } from "rethinkdb-ts";
import { Store } from "express-session";
import NodeCache from "node-cache";
import { r } from "rethinkdb-ts";
const cache = new NodeCache();

// Session connection options
interface SessionOptions {
  // The ReQL table to store sessions. Defaults to "session".
  table?: string | "session";

  // The timeout (in ms) in which sessions should timeout. Defaults to 1 day.
  sessionTimeout?: number | 86_400_000;

  // The interval (in ms) that which sessions should be flushed.
  flushInterval?: number | 60_000;

  // ReQL connection options.
  connectOptions?: RPoolConnectionOptions;
}

export class RethinkDBStore extends Store {
  readonly db: typeof r;
  readonly sessionTimeout: number;
  readonly sessionTable: string;

  /**
   * Creates a new rethinkdb session store
   * @param options RethinkDB options
   * @param rInstance An optional existing instance to use
   */

  constructor(options: SessionOptions, rInstance?: typeof r) {
    options = options ?? {};
    options.connectOptions = options.connectOptions ?? {};
    super(options as any);

    this.db = rInstance ?? r;
    this.emit("connecting");

    // Default session timeout is 1 day
    this.sessionTimeout = options.sessionTimeout ?? 86_400_000;
    this.sessionTable = options.table ?? "session";

    // Expiration flushing
    setInterval(() => {
      try {
        this.db.table(this.sessionTable).filter(this.db.row("expires").lt(this.db.now().toEpochTime().mul(1000)));
      } catch (error) {
        console.error(error);
        return;
      }
    }, options.flushInterval || 60_000);
  }

  // Gets a session
  public get(id: string, fn: any) {
    const sessionData = cache.get(`sess-${id}`);
    if (sessionData) return fn(undefined, JSON.parse((sessionData as Record<string, string>).session));

    this.db
      .table(this.sessionTable)
      .get(id)
      .run()
      .then((data) => fn(undefined, data ? JSON.parse(data.session) : undefined))
      .catch((error) => fn(error));
  }

  // Sets a session
  public set(id: string, sess: SessionData, fn: any) {
    const sessionToStore = {
      id: id,
      expires: Date.now() + (sess.cookie.originalMaxAge || this.sessionTimeout),
      session: JSON.stringify(sess),
    };

    this.db
      .table(this.sessionTable)
      .insert(sessionToStore, { conflict: "replace", returnChanges: true })
      .run()
      .then((data) => {
        let sessionData;
        if (data.changes?.[0] !== undefined) sessionData = data.changes[0].new_val || undefined;
        if (sessionData) cache.set(`sess-${sessionData.id}`, sessionData, 30_000);
        if (typeof fn === "function") return fn();
        return;
      })
      .catch((error) => fn(error));
  }

  // Destroys a session
  public destroy(id: string, fn: any) {
    cache.del(`sess-${id}`);
    this.db
      .table(this.sessionTable)
      .get(id)
      .delete()
      .run()
      .then(() => {
        if (typeof fn === "function") return fn();
        return;
      })
      .catch((error) => fn(error));
  }
}
