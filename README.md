# session-rethinkdb-ts

A RethinkDB session store for express-session.

## Maintenance Mode

This package is in maintenance mode and will only receive security and major bug-fix updates.

## Installation

```sh
# npm
npm i session-rethinkdb-ts
# yarn
yarn add session-rethinkdb-ts
# pnpm
pnpm add session-rethinkdb-ts
# or, if you're cool and use bun
bun add session-rethinkdb-ts
```

## Usage

For a list of valid connectOptions, see the [typings][options] for rethinkdb-ts. Additionally, you can pass an already existing store via the 2nd paramater.

```TS
import { RethinkDBStore } from "session-rethinkdb-ts";
import express from "express";
import session from "express-session";

const app = express();

// Creates the store
const store = new RethinkDBStore({
  // RethinkDB connection options.
  connectOptions: {
    db: "db",
  },
  sessionTable: "session", // RethinkDB table to store session info to. Defaults to "session".
  sessionTimeout: 86400000, // How long a session ID is valid for. Defaults to 1 day.
  flushTimeout: 60000, // How long to wait before flushing data. Defaults to 1 minute.
});

// Uses express session with the store
// Valid options: https://github.com/expressjs/session#sessionoptions
app.use(session({
  store: store,
  saveUninitialized: false,
}));

// The rest of your Express server code...
```

## License

[zlib][zlib]

[zlib]: "LICENSE.md" "A link to the zlib license."
[options]: https://github.com/rethinkdb/rethinkdb-ts/blob/de4c51a53f8bc50c2784f302a831938e3e4cfd1a/src/types.ts#L41 "RethinkDB Connect Options"
