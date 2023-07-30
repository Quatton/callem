// import { Resend } from "resend";

// const resend = new Resend(Bun.env.RESEND_API_KEY);

export async function sendCallSummary(
  summary: string,
  caller: string,
  callerEmail: string
) {
  // await resend.sendEmail({
  //   to: Bun.env.RESEND_EMAIL_TO!,
  //   from: Bun.env.RESEND_EMAIL_FROM!,
  //   subject: "Call Summary from " + caller,
  //   text: summary,
  // });

  await fetch("https://api.resend.com/emails", {
    headers: {
      Authorization: "Bearer " + Bun.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify({
      to: [callerEmail, Bun.env.RESEND_EMAIL_TO!],
      from: Bun.env.RESEND_EMAIL_FROM!,
      subject: "Call Summary from " + caller,
      text: summary,
    }),
  });
}
