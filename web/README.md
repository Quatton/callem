# Call'em - Web & Backend

## Description

This folder includes both frontend and backend of Call'em. The "frontend" is built with HTMX & Hyperscript, and the backend is built with Elysia on Bun runtime.

## Getting Started

### Set up the environment variables

Follow `.env.example` to create `.env` file in the `web/` directory.

### Install dependencies

I use [Bun](https://bun.sh/) as the runtime. It's not available on Windows so I just use WSL to run it.

```bash
bun install
```

### Running scripts

To generate `public/styles/globals.css`

```bash
bun run tw
```

To push migrations to Turso database

```bash
bun run db:push
```

And to launch Drizzle Studio

```bash
bun run db:studio
```

### Running the app in development mode

## Connecting to Twilio

You cannot use `http://localhost:3000` to connect to Twilio. You need to use a tunneling service like [ngrok](https://ngrok.com/) to expose your local server to the internet.

```bash
ngrok http 3000
```

Then you can use the URL provided by ngrok to connect to Twilio.

There are two main endpoints and one status logging endpoint.

```
https://<ngrok-url>/transcribe # The entrypoint of your first call message
https://<ngrok-url>/respond # The callback URL after gathering the speech input
https://<ngrok-url>/call-status # The callback URL for emailing the call summary
```

More information in my `/routes/twilio.ts` file.
