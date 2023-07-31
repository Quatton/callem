import { t } from "elysia";

export const twilioRequestBody = t.Object({
  Called: t.String(),
  ToState: t.String(),
  CallerCountry: t.String(),
  Direction: t.Union([t.Literal("inbound"), t.Literal("outbound-api")]),
  SpeechResult: t.String(),
  CallerState: t.String(),
  Language: t.String(),
  Confidence: t.String(),
  ToZip: t.String(),
  CallSid: t.String(),
  To: t.String(),
  CallerZip: t.String(),
  ToCountry: t.String(),
  ApiVersion: t.String(),
  CalledZip: t.String(),
  CallStatus: t.Union([
    t.Literal("queued"),
    t.Literal("ringing"),
    t.Literal("in-progress"),
    t.Literal("completed"),
    t.Literal("busy"),
    t.Literal("failed"),
    t.Literal("canceled"),
    t.Literal("no-answer"),
  ]),
  CalledCity: t.String(),
  From: t.String(),
  AccountSid: t.String(),
  CalledCountry: t.String(),
  CallerCity: t.String(),
  Caller: t.String(),
  FromCountry: t.String(),
  ToCity: t.String(),
  FromCity: t.String(),
  CalledState: t.String(),
  FromZip: t.String(),
  FromState: t.String(),
});

export const twilioCallStatusBody = t.Object({
  Called: t.String(),
  ToState: t.String(),
  CallerCountry: t.String(),
  Direction: t.Union([t.Literal("inbound"), t.Literal("outbound-api")]),
  Timestamp: t.String(),
  CallbackSource: t.String(),
  CallerState: t.String(),
  ToZip: t.String(),
  SequenceNumber: t.String(),
  To: t.String(),
  CallSid: t.String(),
  ToCountry: t.String(),
  CallerZip: t.String(),
  CalledZip: t.String(),
  ApiVersion: t.String(),
  SipResponseCode: t.Optional(t.String()),
  CallStatus: t.Union([
    t.Literal("queued"),
    t.Literal("ringing"),
    t.Literal("in-progress"),
    t.Literal("completed"),
    t.Literal("busy"),
    t.Literal("failed"),
    t.Literal("canceled"),
    t.Literal("no-answer"),
  ]),
  CalledCity: t.String(),
  Duration: t.String(),
  From: t.String(),
  CallDuration: t.String(),
  AccountSid: t.String(),
  CalledCountry: t.String(),
  CallerCity: t.String(),
  ToCity: t.String(),
  FromCountry: t.String(),
  Caller: t.String(),
  FromCity: t.String(),
  CalledState: t.String(),
  FromZip: t.String(),
  FromState: t.String(),
});

export type TwilioRequestBody = {
  Called: string;
  ToState: string;
  CallerCountry: string;
  Direction: "inbound" | "outbound-api";
  SpeechResult: string;
  CallerState: string;
  Language: string;
  Confidence: string;
  ToZip: string;
  CallSid: string;
  To: string;
  CallerZip: string;
  ToCountry: string;
  ApiVersion: string;
  CalledZip: string;
  CallStatus: string;
  CalledCity: string;
  From: string;
  AccountSid: string;
  CalledCountry: string;
  CallerCity: string;
  Caller: string;
  FromCountry: string;
  ToCity: string;
  FromCity: string;
  CalledState: string;
  FromZip: string;
  FromState: string;
};

export const twilioFirstRequestBody = t.Composite([
  t.Omit(twilioRequestBody, ["SpeechResult", "Language", "Confidence"]),
  t.Object({
    CallToken: t.Optional(t.String()),
  }),
]);

export type TwilioFirstRequestBody = Omit<
  TwilioRequestBody,
  "SpeechResult" | "Language" | "Confidence"
> & {
  CallToken?: string;
};

export type TwilioStreamConnectedMessage = {
  event: "connected";
  protocal: "Call";
  version: string;
};

export const twilioStreamConnectedMessage = t.Object({
  event: t.Literal("connected"),
  protocal: t.Literal("Call"),
  version: t.String(),
});

export type TwilioStreamStartMessage = {
  event: "start";
  sequenceNumber: string;
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: ["inbound"] | ["outbound"] | ["inbound", "outbound"];
    customParameters: {
      text: string;
    };
    mediaFormat: {
      encoding: "audio/x-mulaw";
      sampleRate: 8000;
      channels: 1;
    };
  };
  streamSid: string;
};

export const twilioStreamStartMessage = t.Object({
  event: t.Literal("start"),
  sequenceNumber: t.String(),
  start: t.Object({
    streamSid: t.String(),
    accountSid: t.String(),
    callSid: t.String(),
    tracks: t.Array(t.Literal("inbound"), t.Literal("outbound")),
    customParameters: t.Object({
      text: t.String(),
    }),
    mediaFormat: t.Object({
      encoding: t.Literal("audio/x-mulaw"),
      sampleRate: t.Literal(8000),
      channels: t.Literal(1),
    }),
  }),
  streamSid: t.String(),
});

export type TwilioStreamMediaMessage = {
  event: "media";
  sequenceNumber: string;
  media: {
    track: "inbound" | "outbound";
    chunk: "1";
    timestamp: "5";
    payload: string;
  };
  streamSid: string;
};

export const twilioStreamMediaMessage = t.Object({
  event: t.Literal("media"),
  sequenceNumber: t.String(),
  media: t.Object({
    track: t.Literal("inbound"),
    chunk: t.String(),
    timestamp: t.String(),
    payload: t.String(),
  }),
  streamSid: t.String(),
});

export type TwilioStreamStopMessage = {
  event: "stop";
  sequenceNumber: string;
  stop: {
    accountSid: string;
    callSid: string;
  };
  streamSid: string;
};

export const twilioStreamStopMessage = t.Object({
  event: t.Literal("stop"),
  sequenceNumber: t.String(),
  stop: t.Object({
    accountSid: t.String(),
    callSid: t.String(),
  }),
  streamSid: t.String(),
});

export type TwilioStreamMediaMessagePayload = {
  event: "media";
  streamSid: string;
  media: {
    payload: string;
  };
};

export const twilioStreamMediaMessagePayload = t.Object({
  event: t.Literal("media"),
  streamSid: t.String(),
  media: t.Object({
    payload: t.String(),
  }),
});

export const twilioStreamMarkMessagePayload = t.Object({
  event: t.Literal("mark"),
  streamSid: t.String(),
  mark: t.Object({
    name: t.Union([t.Literal("start"), t.Literal("end")]),
  }),
});

export type TwilioStreamMarkMessagePayload = {
  event: "mark";
  streamSid: string;
  mark: {
    name: "start" | "end";
  };
};

export type TwilioStreamRequestMessage =
  | TwilioStreamConnectedMessage
  | TwilioStreamStartMessage
  | TwilioStreamMediaMessage
  | TwilioStreamStopMessage
  | TwilioStreamMarkMessagePayload;

export type TwilioStreamResponseMessage =
  | TwilioStreamMediaMessagePayload
  | TwilioStreamMarkMessagePayload;
