import type { SessionData } from "express-session";
import { Store } from "express-session";
import NodeCache from "node-cache";
import type { RPoolConnectionOptions } from "rethinkdb-ts";
import { r } from "rethinkdb-ts";
const cache = new NodeCache();

// Session connection options
interface SessionOptions {
	// The ReQL table to store sessions. Defaults to "session".
	table?: "session";

	// The timeout (in ms) in which sessions should timeout. Defaults to 1 day.
	sessionTimeout?: number;

	// The interval (in ms) that which sessions should be flushed.
	flushInterval?: number;

	// ReQL connection options.
	connectOptions?: RPoolConnectionOptions;
}

interface StoredSessionData extends SessionData {
	id?: string;
	session?: string;
}

type PossibleStoredSessionData = StoredSessionData | undefined;

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
		options.connectOptions = options.connectOptions ?? {};
		super();

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
		}, options.flushInterval ?? 60_000);
	}

	// Gets a session
	public get(id: string, fn: (arg0?: string, arg1?: PossibleStoredSessionData) => unknown) {
		const sessionData: PossibleStoredSessionData = cache.get(`sess-${id}`);

		if (sessionData?.session) {
			const parsedData = JSON.parse(sessionData.session) as StoredSessionData | undefined;
			fn(undefined, parsedData);
			return;
		}

		this.db
			.table(this.sessionTable)
			.get(id)
			.run()
			.then((data: PossibleStoredSessionData) =>
				fn(undefined, data?.session ? (JSON.parse(data.session) as PossibleStoredSessionData) : undefined),
			)
			.catch((error: string) => fn(error));
	}

	// Sets a session
	public set(id: string, sess: SessionData, fn: (arg0?: unknown) => unknown) {
		const sessionToStore = {
			id: id,
			expires: Date.now() + (sess.cookie.originalMaxAge ?? this.sessionTimeout),
			session: JSON.stringify(sess),
		};

		this.db
			.table(this.sessionTable)
			.insert(sessionToStore, { conflict: "replace", returnChanges: true })
			.run()
			.then((data) => {
				let sessionData: PossibleStoredSessionData;
				if (data.changes?.[0]) {
					sessionData = data.changes[0]?.new_val as StoredSessionData;
				}

				if (sessionData) {
					cache.set(`sess-${sessionData.id}`, sessionData, 30_000);
				}

				if (typeof fn === "function") {
					return fn();
				}

				return;
			})
			.catch((error) => fn(error));
	}

	// Destroys a session
	public destroy(id: string, fn: (arg0?: unknown) => unknown) {
		cache.del(`sess-${id}`);
		this.db
			.table(this.sessionTable)
			.get(id)
			.delete()
			.run()
			.then(() => {
				if (typeof fn === "function") {
					return fn();
				}

				return;
			})
			.catch((error) => fn(error));
	}
}
