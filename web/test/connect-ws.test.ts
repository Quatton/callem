import { expect, test } from "bun:test";
import {
  TwilioStreamResponseMessage,
  TwilioStreamStartMessage,
} from "../src/types/twilio";
import { WaveFile } from "wavefile";
import { createWriteStream } from "fs";

test(
  "connect to ws",
  async () => {
    const ws = new WebSocket(`wss://${process.env.BASE_URL}/audio/1234`);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          event: "start",
          sequenceNumber: "1",
          start: {
            customParameters: {
              text: "Hello world",
            },
            tracks: ["inbound"],
            accountSid: "AC123",
            callSid: "1234",
            mediaFormat: {
              encoding: "audio/x-mulaw",
              sampleRate: 8000,
              channels: 1,
            },
            streamSid: "123456",
          },
          streamSid: "123456",
        } satisfies TwilioStreamStartMessage)
      );
    };

    const messages: Buffer[] = [];
    ws.onmessage = (ev) => {
      const message = JSON.parse(
        ev.data as string
      ) as TwilioStreamResponseMessage;
      console.log(message);

      if (message.event === "mark") {
        if (message.mark.name === "end") {
          ws.close();
        }
      }
      if (message.event !== "media") return;
      const payload = Buffer.from(message.media.payload, "base64");
      messages.push(payload);
    };

    await new Promise<void>((resolve) => {
      ws.onclose = () => {
        if (messages.length > 0) {
          const payload = Buffer.concat(messages);

          const wav = new WaveFile();
          wav.fromBuffer(payload);

          const audio = createWriteStream("./test/audio/test.wav");
          audio.write(wav.toBuffer());
        }
        resolve();
      };
    });
  },
  {
    timeout: 20_000,
  }
);

test.skip("simple", async () => {
  const ws = new WebSocket(`wss://${process.env.BASE_URL}/simple`);
  const receive = [];

  ws.onmessage = (ev) => {
    receive.push(ev.data);
    ws.close();
  };

  await new Promise<void>((resolve) => {
    ws.onclose = () => {
      resolve();
    };
  });

  expect(receive.length).toBeGreaterThan(0);
});
