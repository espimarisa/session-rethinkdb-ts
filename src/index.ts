/**
 * @file session-rethinkdb-ts
 * @description A modern RethinkDB session store for Express.
 * @author Espi <espi@riseup.net>
 * @license MIT
 */

import type { RPoolConnectionOptions } from "rethinkdb-ts";
import type { SessionData } from "express-session";
import { r } from "rethinkdb-ts";
import NodeCache from "node-cache";
import session from "express-session";
const cache = new NodeCache();

export class RethinkDBStore extends session.Store {
  options: Record<string, unknown>;
  db: typeof r;
  sessionTimeout: number | undefined;
  sessionTable: string | undefined;

  constructor(options: RPoolConnectionOptions) {
    options = options || {};
    options.connectOptions = options.connectOptions || {};
    super(options as Record<string, unknown>);

    this.db = r;
    this.emit("connecting");

    // Default session timeout is 1 day
    this.sessionTimeout = options.sessionTimeout || 86400000;
    this.sessionTable = options.table || "session";

    // Expiration flushing
    setInterval(() => {
      try {
        this.db.table(this.sessionTable).filter(this.db.row("expires").lt(this.db.now().toEpochTime().mul(1000)));
      } catch (err) {
        console.error(err);
        return null;
      }
      // Defaults to flushing every minute
    }, options.flushInterval || 60000);
  }

  // Gets a session
  get(id: string, fn: any) {
    const sessionData = cache.get(`sess-${id}`);
    if (sessionData) return fn(null, JSON.parse((sessionData as Record<string, string>).session));

    this.db
      .table(this.sessionTable)
      .get(id)
      .run()
      .then((data) => fn(null, data ? JSON.parse(data.session) : null))
      .catch((err) => fn(err));
  }

  // Sets a session
  set(id: string, sess: SessionData, fn: any) {
    const sessionToStore = {
      id: id,
      expires: new Date().getTime() + (sess.cookie.originalMaxAge || this.sessionTimeout),
      session: JSON.stringify(sess),
    };

    this.db
      .table(this.sessionTable)
      .insert(sessionToStore, { conflict: "replace", returnChanges: true })
      .run()
      .then((data) => {
        let sdata = null;
        if (data.changes[0] != null) sdata = data.changes[0].new_val || null;
        if (sdata) cache.set(`sess-${sdata.id}`, sdata, 30000);
        if (typeof fn === "function") return fn();

        return null;
      })
      .catch((err) => fn(err));
  }

  // Destroys a session
  destroy(id: string, fn: any) {
    cache.del(`sess-${id}`);
    this.db
      .table(this.sessionTable)
      .get(id)
      .delete()
      .run()
      .then(() => {
        if (typeof fn === "function") return fn();
        return null;
      })
      .catch((err) => fn(err));
  }
}
