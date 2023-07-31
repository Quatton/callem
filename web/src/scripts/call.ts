import { Twilio } from "twilio";

const twilio = new Twilio(
  Bun.env.TWILIO_ACCOUNT_SID,
  Bun.env.TWILIO_AUTH_TOKEN
);

const call = await twilio.calls.create({
  url: `https://${Bun.env.BASE_URL}/transcribe`,
  to: "+818038565554",
  from: Bun.env.PHONE_NUMBER!,
});

console.log(call.sid);
