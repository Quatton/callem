import { Elysia, t, ws } from "elysia";
import Twilio from "twilio";
import { twilioCallStatusBody, twilioRequestBody } from "./types/twilio";
import { XMLParser } from "fast-xml-parser";
import cookie from "@elysiajs/cookie";
import { Conversation } from "./types/convo";
import { textToSpeechStream, toTempFile } from "./utils/xi";
import { staticPlugin } from "@elysiajs/static";
import { unlinkSync } from "fs";

const twilioPlugin = (app: Elysia) =>
  app
    .use(ws())
    .use(cookie())
    .model(
      "audio-stream-header",
      t.Object({
        "x-call-sid": t.String(),
      })
    )
    .model(
      "audio-stream-body",
      t.Object({
        text: t.String(),
      })
    )
    .onParse(async ({ request }, contentType) => {
      if (contentType === "application/xml") {
        const xml = await request.text();
        const parser = new XMLParser();
        const json = parser.parse(xml);
        return json;
      }
    })
    .onError(({ error }) => {
      console.error(error);
      return error.message;
    })
    .derive((_) => ({
      twiml: new Twilio.twiml.VoiceResponse(),
    }))
    .derive(({ cookie, setCookie }) => {
      const convo = cookie.convo;
      try {
        return {
          convo: JSON.parse(convo) as Conversation,
        };
      } catch (e) {
        return {
          convo: {
            messages: [],
          },
          setConvo: (newConvo: Conversation) => {
            setCookie("convo", JSON.stringify(newConvo), {
              path: "/",
            });
          },
        };
      }
    })
    .derive(({ cookie, setCookie }) => {
      const callSid = cookie.callSid;
      return {
        callSid,
        setCallSid: (newCallSid: string) => {
          setCookie("callSid", newCallSid, {
            path: "/",
          });
        },
      };
    })
    .post(
      "/call-status",
      ({ body }) => {
        if (body.CallStatus === "completed") {
          unlinkSync(`./src/public/audio/${body.CallSid}.mp3`);
        }
      },
      {
        body: twilioCallStatusBody,
      }
    )
    .post("/transcribe", ({ twiml, set }) => {
      set.headers = {
        "Content-Type": "application/xml",
      };

      const gather = twiml.gather({
        speechTimeout: "auto",
        speechModel: "experimental_conversations",
        input: ["speech"],
        action: "/respond",
        method: "POST",
      });

      gather.play(`https://${Bun.env.BASE_URL}/public/audio/greeting.mp3`);

      return twiml.toString();
    })
    .post(
      "/respond",
      async ({ twiml, body, set }) => {
        const voiceInput = body.SpeechResult;

        const response = await textToSpeechStream(`
          Okay, I heard you say ${voiceInput}.
        `);

        await toTempFile(response, body.CallSid);

        twiml.play(
          `https://${Bun.env.BASE_URL}/public/audio/${body.CallSid}.mp3`
        );

        twiml.redirect("/transcribe");

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
  .use(
    staticPlugin({
      assets: "./src/public",
    })
  )
  .use(twilioPlugin)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
