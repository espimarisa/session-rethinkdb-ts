# session-rethinkdb-ts

A modern RethinkDB session store for Express.

## Installation

```sh
# npm
npm i --save session-rethinkdb-ts

# yarn
yarn add session-rethinkdb-ts

# pnpm
pnpm add session-rethinkdb-ts
```

## Usage

For a list of valid connectOptions, see the [typings][options] for rethinkdb-ts. Additionally, you can pass an already existing store via the 2nd paramater.

```TS
// If you're using TS/ESM
import { RethinkDBStore } from "session-rethinkdb-ts";
import express from "express";
import session from "express-session";

// ...or if you're not, use this instead!
// const { RethinkDBStore } = require("session-rethinkdb-ts");
// const express = require("express");
// const session = require("express-session");

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

[MIT][mit]

## Attribution

This library is loosely based on [express-session-rethinkdb][express-session-rethinkdb].

[mit]: "LICENSE" "Licensed under the MIT License."
[express-session-rethinkdb]: https://github.com/armenfilipetyan/express-session-rethinkdb "Express-Session-RethinkDB on GitHub."
[options]: https://github.com/rethinkdb/rethinkdb-ts/blob/de4c51a53f8bc50c2784f302a831938e3e4cfd1a/src/types.ts#L41 "RethinkDB Connect Options"
