import cookie from "@elysiajs/cookie";
import Elysia, { ws, t } from "elysia";
import { XMLParser } from "fast-xml-parser";
import { unlinkSync } from "fs";
import Twilio from "twilio";
import { Conversation } from "../types/convo";
import { twilioCallStatusBody, twilioRequestBody } from "../types/twilio";
import { createChatCompletion } from "../utils/openai";
import { textToSpeechStream, toTempFile } from "../utils/xi";

export const twilioPlugin = (app: Elysia) =>
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
    .derive(({ cookie }) => {
      const convo = cookie.convo;
      try {
        return {
          convo: JSON.parse(convo) as Conversation,
        };
      } catch (e) {
        return {
          convo: {
            messages: [],
          } as Conversation,
        };
      }
    })
    .derive(({ setCookie }) => ({
      setConvo: (newConvo: Conversation) => {
        setCookie("convo", JSON.stringify(newConvo), {
          path: "/",
        });
      },
    }))
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
      async ({ body }) => {
        if (body.CallStatus === "completed") {
          const file = Bun.file(`./public/audio/${body.CallSid}.mp3`);
          if (await file.exists())
            unlinkSync(`./public/audio/${body.CallSid}.mp3`);
        }
      },
      {
        body: twilioCallStatusBody,
      }
    )
    .post(
      "/transcribe",
      async ({ body, twiml, set, convo, setConvo }) => {
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

        if (convo.messages.length === 0) {
          const { data } = await createChatCompletion(
            convo.messages,
            "Greet the user with enthusiasm"
          );

          const firstMessage = data
            ? data.completion
            : "Hello! This is Nutchanon. I am a very real human being -- not a robot whatsoever.";
          setConvo({
            messages: [
              ...convo.messages,
              {
                role: "assistant",
                content: firstMessage,
              },
            ],
          });

          const response = await textToSpeechStream(firstMessage);
          await toTempFile(response, body.CallSid);

          gather.play(
            `https://${Bun.env.BASE_URL}/public/audio/${body.CallSid}.mp3`
          );
        }

        return twiml.toString();
      },
      {
        body: t.Composite([
          t.Omit(twilioRequestBody, ["SpeechResult", "Language", "Confidence"]),
          t.Object({
            CallToken: t.Optional(t.String()),
          }),
        ]),
      }
    )
    .post(
      "/respond",
      async ({ twiml, body, set, convo, setConvo }) => {
        const voiceInput = body.SpeechResult;

        setConvo({
          messages: [
            ...convo.messages,
            {
              role: "user",
              content: voiceInput,
            },
          ],
        });

        const { data, error } = await createChatCompletion(
          convo.messages,
          voiceInput
        );

        const nextMessage = data
          ? data.completion
          : "Sorry, I don't understand. I will call you back later.";

        setConvo({
          messages: [
            ...convo.messages,
            {
              role: "assistant",
              content: nextMessage,
            },
          ],
        });

        const response = await textToSpeechStream(nextMessage);
        await toTempFile(response, body.CallSid);

        twiml.play(
          `https://${Bun.env.BASE_URL}/public/audio/${body.CallSid}.mp3`
        );

        if (error) {
          console.error(error);
          twiml.hangup();
        } else {
          if (data.end_call) twiml.hangup();
          else twiml.redirect("/transcribe");
        }

        set.headers = {
          "Content-Type": "application/xml",
        };

        return twiml.toString();
      },
      {
        body: twilioRequestBody,
      }
    );
