/**
 * @file session-rethinkdb-ts
 * @description A RethinkDB session store for express-session.
 * @author Espi Marisa <contact@espi.me>
 * @license zlib
 */

import type { SessionData } from "express-session";
import { Store } from "express-session";
import NodeCache from "node-cache";
import type { RPoolConnectionOptions } from "rethinkdb-ts";
import { r } from "rethinkdb-ts";

const cache = new NodeCache();

/**
 * session-rethinkdb-ts session options.
 */

export type SessionOptions = {
  /**
   * The ReQL table to store data to.
   * @default session
   */

  table?: "session";

  /**
   * The timeout (in ms) in which sessions should timeout.
   * @default 60000
   */

  sessionTimeout?: number;

  // The interval (in ms) that which sessions should be flushed.

  /**
   * The interval (in ms) in which sessions should be flushed.
   * @default 86400000
   */

  flushInterval?: number;

  /**
   * An object of ReQL connection options.
   * @default {}
   */

  connectOptions?: RPoolConnectionOptions;
};

/**
 * session-rethinkdb-ts stored session data.
 */

export interface StoredSessionData extends SessionData {
  /**
   * The ID of the session returned.
   */

  id?: string;

  /**
   * A string containing session information.
   */

  session?: string;
}

/** Possible stored session data for session-rethinkdb-ts. */
export type PossibleStoredSessionData = StoredSessionData | undefined;

export class RethinkDBStore extends Store {
  readonly db: typeof r;
  readonly sessionTimeout: number;
  readonly sessionTable: string;

  /**
   * Creates a new RethinkDB session store.
   * @param options RethinkDB options to pass to the store.
   * @param rInstance An optional existing instance to connect to.
   */

  constructor(options: SessionOptions, rInstance?: typeof r) {
    options.connectOptions = options.connectOptions ?? {};
    super();

    this.db = rInstance ?? r;
    this.emit("connecting");

    // Default session timeout is 1 day.
    this.sessionTimeout = options.sessionTimeout ?? 86_400_000;
    this.sessionTable = options.table ?? "session";

    // Expiration flushing.
    setInterval(() => {
      this.db.table(this.sessionTable).filter(
        // Sets the expiry on the row.
        this.db
          .row("expires")
          .lt(this.db.now().toEpochTime().mul(1000)),
      );
    }, options.flushInterval ?? 60_000);
  }

  /**
   * Gets a session.
   * @param sessionID The session ID to get.
   * @param fn Session callback function.
   * @returns An object of found session information or undefined.
   */

  async get(
    sessionID: string,
    fn: (arg0?: unknown, arg1?: PossibleStoredSessionData) => unknown,
  ) {
    // Finds the session data.
    const sessionData = cache.get(
      `sess-${sessionID}`,
    ) satisfies PossibleStoredSessionData;

    // If no session data is found, return undefined.
    if (!sessionData) {
      return;
    }

    // Parses the session data if it exists.
    if (sessionData?.session) {
      const parsedData = JSON.parse(sessionData.session) satisfies
        | StoredSessionData
        | undefined;

      // Returns the session data.
      fn(undefined, parsedData ?? undefined);
      return;
    }

    // Gets the session data from the database.
    try {
      await this.db
        .table(this.sessionTable)
        .get(sessionID)
        .run()
        .then((data: PossibleStoredSessionData) => {
          // Runs the callback function.
          if (typeof fn === "function") {
            fn(
              undefined,
              data?.session
                ? (JSON.parse(data.session) as PossibleStoredSessionData)
                : undefined,
            );
          }

          return;
        });
    } catch (err) {
      fn(err);
    }
  }

  /**
   * Sets session data.
   * @param sessionID The session ID to set.
   * @param data An object of session data to set.
   * @param fn Session callback function.
   */

  async set(
    sessionID: string,
    data: SessionData,
    fn: (arg0?: unknown) => unknown,
  ) {
    // Creates the session data.
    const sessionToStore = {
      id: sessionID,
      expires: Date.now() + (data.cookie.originalMaxAge ?? this.sessionTimeout),
      session: JSON.stringify(data),
    };

    // Inserts the session data to the database.
    try {
      await this.db
        .table(this.sessionTable)
        .insert(sessionToStore, { conflict: "replace", returnChanges: true })
        .run()
        .then((session) => {
          let sessionData: PossibleStoredSessionData;

          // Checks for changes.
          if (session.changes?.[0]) {
            sessionData = session.changes[0]
              ?.new_val satisfies StoredSessionData;
          }

          // Updates the cache.
          if (sessionData) {
            cache.set(`sess-${sessionData.id}`, sessionData, 30_000);
          }

          // Runs the callback function.
          if (typeof fn === "function") {
            return fn();
          }

          return;
        });
    } catch (err) {
      fn(err);
    }
  }

  /**
   * Destroys a session.
   * @param sessionID The ID of the session to destroy.
   * @param fn Session callback function.
   */

  async destroy(sessionID: string, fn: (arg0?: unknown) => unknown) {
    cache.del(`sess-${sessionID}`);

    try {
      // Deletes the session data.
      await this.db
        .table(this.sessionTable)
        .get(sessionID)
        .delete()
        .run()
        .then(() => {
          // Runs the callback function.
          if (typeof fn === "function") {
            return fn();
          }

          return;
        });
    } catch (err) {
      fn(err);
    }
  }
}
