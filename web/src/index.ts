import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { twilioPlugin } from "./routes/twilio";
import { htmxPlugin } from "./routes/htmx";

const app = new Elysia()
  .use(staticPlugin())
  .onError(({ error }) => {
    console.error(error);
    return error.message;
  })
  .group("/twilio", twilioPlugin)
  .use(htmxPlugin)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
