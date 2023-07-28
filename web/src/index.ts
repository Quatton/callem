import { Elysia } from "elysia";
import Twilio from "twilio";
import { twilioRequestBody } from "./types/twilio";
import { XMLParser } from "fast-xml-parser";

const twilioPlugin = (app: Elysia) =>
  app
    .onParse(async ({ request }, contentType) => {
      if (contentType === "application/xml") {
        const xml = await request.text();
        const parser = new XMLParser();
        const json = parser.parse(xml);
        return json;
      }
    })
    .derive((_) => ({
      twiml: new Twilio.twiml.VoiceResponse(),
    }))
    .post("/transcribe", ({ twiml, set }) => {
      const gather = twiml.gather({
        speechTimeout: "auto",
        speechModel: "experimental_conversations",
        input: ["speech"],
        action: "/respond",
        method: "POST",
      });

      const firstMessage = "Say something, and I'll repeat it back to you.";

      gather.say(firstMessage);

      set.headers = {
        "Content-Type": "application/xml",
      };

      return twiml.toString();
    })
    .post(
      "/respond",
      ({ twiml, body, set }) => {
        const voiceInput = body.SpeechResult;

        twiml.say(`You said ${voiceInput}`);

        set.headers = {
          "Content-Type": "application/xml",
        };

        return twiml.toString();
      },
      {
        body: twilioRequestBody,
      }
    );

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(twilioPlugin)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
