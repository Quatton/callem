export const XI_URL = "https://api.elevenlabs.io/v1";
export const XI_VOICE_ID = Bun.env.XI_VOICE_ID!;
export const XI_API_KEY = Bun.env.XI_API_KEY!;

export function textToSpeechStream(text: string) {
  const url = new URL(`${XI_URL}/text-to-speech/${XI_VOICE_ID}/stream`);

  const headers = {
    Accept: "audio/mpeg",
    "xi-api-key": XI_API_KEY,
    "Content-Type": "application/json",
  };

  const data = {
    text,
    model_id: "eleven_monolingual_v1",
    voice_setting: {
      stability: 0.5,
      similarity_boost: 0.7,
    },
  };

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
}

export const toTempFile = async (response: Response, callSid: string) => {
  const tempFile = Bun.file(`./src/public/audio/${callSid}.mp3`);
  const tempWriter = tempFile.writer();

  await response.body?.pipeTo(
    new WritableStream({
      write(chunk) {
        tempWriter.write(chunk);
      },
      close() {
        tempWriter.end();
      },
      abort() {
        tempWriter.end();
      },
    })
  );
};
