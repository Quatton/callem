import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { twilioPlugin } from "./routes/twilio";

const app = new Elysia()
  .use(
    staticPlugin({
      assets: "./src/public",
    })
  )
  .onError(({ error }) => {
    console.error(error);
    return error.message;
  })
  .use(twilioPlugin)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
