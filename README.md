```md
### Nodejs Classes for Twitch Helix and EventSub

A small, focused utility library that exposes two helpers: **Helix** for Twitch Helix API calls and **Subscribe** for creating EventSub websocket subscriptions. The classes handle API requests and subscription creation only. **WebSocket connection management and event handling must be implemented by the consumer**

---

### Installation

**Install via npm**

```bash
npm install twitch-api-kit
```

---

### Compatibility

- **Node 18+** is recommended. This library relies on native `fetch` and `AbortController`.
- If you use **Node 16 or older**, install a fetch polyfill:

  ```bash
  npm install node-fetch@2
  ```

---

### Quick Start

**Import and instantiate**

```js
const { Helix, Subscribe } = require("twitch-api-kit");

// Helix
const helix = new Helix({
  client_token: "YOUR_OAUTH_TOKEN",
  client_id: "YOUR_CLIENT_ID",
  channelName: "your_channel"
});
await helix.init();

// Subscribe
const sub = new Subscribe({
  clientId: "YOUR_CLIENT_ID",
  token: "YOUR_OAUTH_TOKEN",
  broadcasterId: "BROADCASTER_USER_ID",
  sessionId: "YOUR_WEBSOCKET_SESSION_ID"
});
await sub.toFollows();
```

**Important**  
The library **does not** open or manage WebSocket connections. Use your own WebSocket client (for example `ws`) to create a session and forward the `session_id` to `Subscribe`. Handle incoming EventSub messages and dispatch them to your app.

---

### API Reference

#### Helix class

**Constructor options**
- **client_token** `string` — OAuth token with required scopes  
- **client_id** `string` — Twitch app client id  
- **channelName** `string` — broadcaster login name  

**Key methods**
- `init()` → `Promise<void>`
- `viewerCount()` → `Promise<number>`
- `getUserID(username)` → `Promise<string | null>`
- `followCount()` → `Promise<number>`
- `lastFollow()` → `Promise<string | null>`
- `createClip(title?, duration?)` → `Promise<object | null>`
- `createCustomReward(options)` → `Promise<object | null>`
- `updateRedemptionStatus(options)` → `Promise<object>`
- `cheerLeaderboard()` → `Promise<Array>`

#### Subscribe class

**Constructor options**
- **clientId** `string`  
- **token** `string`  
- **broadcasterId** `string | null`  
- **sessionId** `string | null`  

**Key methods**
- `toFollows()` → `Promise<boolean>`
- `toRedemptions()` → `Promise<boolean>`
- `toStreamOnline()` → `Promise<boolean>`
- `toStreamOffline()` → `Promise<boolean>`
- `toChannelUpdate()` → `Promise<boolean>`
- `toAll()` → `Promise<object>`

---

### Example: Using the Helix class

```js
const { Helix } = require("twitch-api-kit");

(async () => {
  // Create the Helix client
  const helix = new Helix({
    client_token: process.env.TWITCH_OAUTH_TOKEN,
    client_id: process.env.TWITCH_CLIENT_ID,
    channelName: "your_channel_name"
  });

  // Initialize (fetches broadcaster_id and sets helix.ready = true)
  await helix.init();
  console.log("Helix is ready. Broadcaster ID:", helix.broadcaster_id);

  // Get viewer count
  const viewers = await helix.viewerCount();
  console.log("Current viewers:", viewers);

  // Get total followers
  const followers = await helix.followCount();
  console.log("Total followers:", followers);

  // Get last follower
  const lastFollower = await helix.lastFollow();
  console.log("Latest follower:", lastFollower);

  // Get user ID of someone
  const userId = await helix.getUserID("some_username");
  console.log("User ID:", userId);

  // Create a clip
  const clip = await helix.createClip("Awesome moment!", 20);
  console.log("Clip created:", clip);

  // Get channel point rewards
  const rewards = await helix.getChannelRewards();
  console.log("Rewards:", rewards);

  // Example: send a shoutout (requires moderator permissions)
  // Replace moderatorId with your broadcaster ID or a moderator ID
  const shoutoutSuccess = await helix.sendShoutout(userId, helix.broadcaster_id);
  console.log("Shoutout sent:", shoutoutSuccess);
})();

```

### Example: Using the Subscribe Class

```js
const WebSocket = require("ws");
const { Subscribe } = require("twitch-api-kit");

const sub = new Subscribe({
  clientId: "CLIENT_ID",
  token: "OAUTH_TOKEN",
  broadcasterId: "BROADCASTER_USER_ID",
  sessionId: null // will be set after welcome message
});

const ws = new WebSocket("wss://eventsub.wss.twitch.tv/ws");

ws.on("open", () => {
  console.log("Connected to Twitch EventSub WebSocket");
});

ws.on("message", async (raw) => {
  const data = JSON.parse(raw);

  if (data.metadata?.message_type === "session_welcome") {
    const sessionId = data.payload.session.id;
    sub.session_id = sessionId;

    console.log("Session ID:", sessionId);

    // Example: subscribe to follow events
    await sub.toFollows();
  }

  // Handle other EventSub messages here...
});
```

---

### TypeScript and Editor Tips

**Bundled typings**
- The package ships `index.d.ts`.  
- `package.json` includes `"types": "index.d.ts"` so TypeScript and VS Code pick up signatures automatically.

**When you add methods**
- Implement the method in JS  
- Add JSDoc above the method  
- Update `index.d.ts`  
- Restart the TypeScript server in VS Code  

**CommonJS export shape**
- Keep `module.exports = { Helix, Subscribe }` in sync with `index.d.ts`.

---

### Contributing and License

**Contributing**
- Add new classes under `classes/`  
- Re-export from `index.js`  
- Update `index.d.ts`  
- Add JSDoc for public methods  
- Follow semver  

## License

The MIT License (MIT)

Copyright (c) 2026 Code Shadow

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

### Checklist for Adding a Method

- Implement JS method  
- Add JSDoc  
- Update `index.d.ts`  
- Ensure `index.js` exports it  
- Update README  
- Bump version  
```

---
