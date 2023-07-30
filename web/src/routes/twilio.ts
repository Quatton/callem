import cookie from "@elysiajs/cookie";
import Elysia, { ws, t } from "elysia";
import { XMLParser } from "fast-xml-parser";
import { unlinkSync } from "fs";
import Twilio from "twilio";
import { Conversation } from "../types/convo";
import { twilioCallStatusBody, twilioRequestBody } from "../types/twilio";
import {
  createCallSummary,
  createChatCompletion,
  createCorrection,
} from "../utils/openai";
import { textToSpeechStream } from "../utils/xi";
import { authMiddleware } from "./htmx";
import jwt from "@elysiajs/jwt";
import { dbPlugin } from "../db/dbPlugin";
import { sendCallSummary } from "../utils/resend";

export const twilioPlugin = (app: Elysia) =>
  app
    .use(ws())
    .use(cookie())
    .use(authMiddleware)
    .use(dbPlugin)
    .use(
      jwt({
        secret: process.env.AUTH_SECRET!,
        name: "playJwt",
        schema: t.Object({
          callSid: t.String(),
          textToPlay: t.String(),
        }),
        exp: "1m",
      })
    )
    // .derive(({ headers }) => ({
    //   playAuth: headers.Authorization,
    // }))
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
      async ({ body, db, convo }) => {
        if (body.CallStatus === "completed") {
          const file = Bun.file(`./audio/${body.CallSid}.mp3`);
          if (await file.exists()) unlinkSync(`./audio/${body.CallSid}.mp3`);

          const From = body.From;

          const user = await db.query.verifiedUser.findFirst({
            where: ({ phone }, { eq }) => eq(phone, From),
          });

          if (!user || !user.email || user.doNotSendEmail) {
            return;
          }

          const { email } = user;

          const { data: summary } = await createCallSummary(convo.messages);

          await sendCallSummary(
            summary ?? "We were unable to generate a summary for this call.",
            From,
            email
          );
        }
      },
      {
        body: twilioCallStatusBody,
      }
    )
    .get(
      "/text-to-speech/:callSid",
      async ({ playJwt, set, params: { callSid }, query: { playToken } }) => {
        const valid = await playJwt.verify(playToken);

        if (valid === false || valid.callSid !== callSid) {
          set.status = 401;
          return "UNAUTHORIZED";
        }

        return await textToSpeechStream(valid.textToPlay);
      },
      {
        params: t.Object({
          callSid: t.String(),
        }),
        query: t.Object({
          playToken: t.String(),
        }),
      }
    )
    .ws("/stream", {
      open: (ws) => {
        ws.send({
          id: "notification",
          message: "Awaiting your call at " + Bun.env.PHONE_NUMBER,
        });
      },
      message: (ws, message) => {
        console.log(message.message);
        ws.send({
          id: "notification",
          message: message.message,
        });
      },
      body: t.Object({
        message: t.String(),
        HEADERS: t.Object({
          "HX-Request": t.Union([t.String(), t.Null()]),
          "HX-Trigger": t.Union([t.String(), t.Null()]),
          "HX-Trigger-Name": t.Union([t.String(), t.Null()]),
          "HX-Target": t.Union([t.String(), t.Null()]),
        }),
      }),
    })
    .post(
      "/transcribe",
      async ({ body, twiml, set, convo, setConvo, playJwt, db }) => {
        const { From } = body;

        const user = await db.query.verifiedUser.findFirst({
          where: ({ phone }, { eq }) => eq(phone, From),
        });

        if (!user) {
          twiml.reject({
            reason: "rejected",
          });
          return twiml.toString();
        }

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

        const messages = convo.messages;

        if (convo.messages.length === 0) {
          const { data } = await createChatCompletion(
            messages,
            "Greet the user with enthusiasm"
          );

          const firstMessage = data
            ? data.completion
            : "Hello! This is Nutchanon. I am a very real human being -- not a robot whatsoever.";

          messages.push({
            role: "assistant",
            content: firstMessage,
          });

          setConvo({
            messages,
          });

          // const response = await textToSpeechStream(firstMessage);
          // await toTempFile(response, body.CallSid);

          const playToken = await playJwt.sign({
            callSid: body.CallSid,
            textToPlay: firstMessage,
          });

          const search = new URLSearchParams({
            playToken,
          });

          gather.play(
            `https://${process.env.BASE_URL}/text-to-speech/${
              body.CallSid
            }?${search.toString()}`
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
      async ({ twiml, body, set, convo, playJwt, setConvo, db }) => {
        const voiceInput = body.SpeechResult;
        const messages = convo.messages;

        const { From } = body;

        const user = await db.query.verifiedUser.findFirst({
          where: ({ phone }, { eq }) => eq(phone, From),
        });

        if (!user) {
          twiml.reject({
            reason: "rejected",
          });
          return twiml.toString();
        }

        const { data: correctedMessageRaw } = await createCorrection(messages, {
          role: "user",
          content: voiceInput,
        });

        const correctedMessage = correctedMessageRaw
          ? correctedMessageRaw.content
          : voiceInput;

        messages.push({
          role: "user",
          content: correctedMessage,
        });

        const { data, error } = await createChatCompletion(
          messages,
          correctedMessage
        );

        const nextMessage = data
          ? data.completion
          : "Sorry, I don't understand. I will call you back later.";

        messages.push({
          role: "assistant",
          content: nextMessage,
        });

        setConvo({
          messages,
        });
        // const response = await textToSpeechStream(nextMessage);
        // await toTempFile(response, body.CallSid);

        const playToken = await playJwt.sign({
          callSid: body.CallSid,
          textToPlay: nextMessage,
        });

        const search = new URLSearchParams({
          playToken,
        });

        twiml.play(
          `https://${process.env.BASE_URL}/text-to-speech/${
            body.CallSid
          }?${search.toString()}`
        );

        if (error) {
          console.error(error);
          twiml.hangup();
        } else {
          if (data.end_call) twiml.hangup();
          else twiml.redirect("/transcribe");
        }

        set.headers["Content-Type"] = "application/xml";

        return twiml.toString();
      },
      {
        body: twilioRequestBody,
      }
    );
