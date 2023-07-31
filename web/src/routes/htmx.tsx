import html from "@elysiajs/html";
import Elysia, { t } from "elysia";
import { BaseHtml } from "../components/baseHtml";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as elements from "typed-html";
import { siteConfig } from "../config/site";
import Twilio from "twilio";
import {
  canCallAgain,
  canCallAgainButFromTwilio,
  isWithinExpiration,
  redirectToError,
  threeCallsLimit,
} from "../utils/auth";
import cookie from "@elysiajs/cookie";
import jwt from "@elysiajs/jwt";
import { type Auth, verifiedUser, calls } from "../db/schema";
import { dbPlugin } from "../db/dbPlugin";
import { eq } from "drizzle-orm";

export const htmxPlugin = (app: Elysia) =>
  app
    .use(html())
    .use(authMiddleware)
    .use(dbPlugin)
    .get("/favicon.ico", () => Bun.file("./src/assets/favicon.ico"))
    .get(
      "/",
      ({
        html,
        auth,
        store: {
          serverMetadata: { info },
        },
      }) =>
        html(
          <BaseHtml>
            <div class="min-h-screen grid place-content-center p-16">
              <div class="grid place-content-center grid-cols-1 sm:grid-cols-2 min-h-96 place-items-center gap-4">
                <LeftPanel auth={auth} />
                <div>
                  {!auth ? (
                    <form
                      hx-post="/verify-phone"
                      class="form-control gap-2"
                      data-loading-path="/verify-phone"
                    >
                      <p>
                        Oops, you're not logged in. Please verify your phone
                        number.
                      </p>
                      <input
                        type="phone"
                        name="phone"
                        class="input input-primary"
                        placeholder="Enter your phone number with the country code"
                        required="true"
                      />
                      <button
                        type="submit"
                        class="btn btn-primary"
                        data-loading-disable
                        data-loading-class-remove="btn-primary"
                        data-loading-class="btn-disabled"
                      >
                        Verify
                      </button>
                    </form>
                  ) : (
                    <div class="text-center flex flex-col items-center">
                      <h1 class="text-4xl font-bold">Welcome</h1>
                      <span class="space-x-1">
                        <span class="text-xl max-w-xs">
                          You are logged in as
                        </span>
                        <span class="text-xl max-w-xs">{auth.phone}</span>
                        <a href="/logout" class="btn btn-error">
                          Logout
                        </a>
                      </span>

                      <ChangeEmailForm email={auth.email} />
                      <ChangeMetadataForm metadata={auth.metadata} />

                      <ChangeMyInfoForm myInfo={info} />
                    </div>
                  )}
                </div>
              </div>
              <div class="text-center mt-8">
                <p>
                  Build by{" "}
                  <a href="https://github.com/Quatton" class="link link-accent">
                    Quatton
                  </a>{" "}
                  for Lablab.ai XI Labs Hackathon (28-30 July 2023)
                </p>
              </div>
            </div>
          </BaseHtml>
        )
    )
    .get(
      "/error",
      ({ html, query: { code, message, redirectTo } }) =>
        html(
          <BaseHtml>
            <div class="grid place-content-center place-items-center gap-4 min-h-screen">
              <div class="text-center">
                <h1 class="text-4xl font-bold">{code}</h1>
                <p class="text-xl max-w-xs">{message}</p>
              </div>

              <a href={redirectTo} class="btn btn-primary">
                Back
              </a>
            </div>
          </BaseHtml>
        ),
      {
        query: t.Object({
          code: t.String({
            default: "UNKNOWN_ERROR",
          }),
          message: t.String({
            default: "Something went wrong",
          }),
          redirectTo: t.String({
            default: "/",
          }),
        }),
      }
    )
    .post(
      "/verify-phone",
      async ({ body, twilio, db, set, html }) => {
        const phone = body.phone;
        const already = await db.query.phoneCodes.findFirst({
          where: (phoneCode, { eq }) => eq(phoneCode.phone, phone),
        });

        if (!already || !isWithinExpiration(already.expires)) {
          try {
            await twilio.verify.v2
              .services(Bun.env.TWILIO_VERIFY_SERVICE_SID!)
              .verifications.create({
                to: phone,
                channel: "sms",
              });
          } catch (e) {
            console.log(e);
            redirectToError({
              set,
              code: "PHONE_CODE_ERROR",
              message: "Cannot send the code to" + phone,
            });
            return;
          }
        }

        return html(
          <form
            action="/verify-code"
            method="POST"
            class="form-control gap-2"
            data-loading-path="/verify-code"
          >
            <input
              type="hidden"
              name="phone"
              value={phone}
              class="input input-primary"
            />
            <input
              type="number"
              name="code"
              class="input input-primary"
              placeholder="Enter the code"
              required="true"
            />
            <input
              type="email"
              name="email"
              class="input input-primary"
              placeholder="Email (Optional)"
            />
            <button
              type="submit"
              class="btn btn-primary"
              data-loading-class-remove="btn-primary"
              data-loading-class="btn-disabled"
              data-loading-disable
            >
              Verify
            </button>
          </form>
        );
      },
      {
        body: t.Object({
          phone: t.String(),
        }),
      }
    )
    .post(
      "/change-email",
      async ({ body, html, auth, set, authJwt, db, removeCookie }) => {
        const email = body.email;

        if (!auth) {
          set.status = 401;
          redirectToError({
            set,
            code: "NOT_AUTHORIZED",
            message: "You are not authorized to do this",
          });
          return;
        }

        const newToken = await authJwt.sign({
          phone: auth.phone,
          email,
          metadata: auth.metadata,
        });

        const user = await db
          .update(verifiedUser)
          .set({ email })
          .where(eq(verifiedUser.phone, auth.phone))
          .returning()
          .get();

        removeCookie("auth_session");
        set.headers[
          "set-cookie"
        ] = `auth_session=${newToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${
          60 * 60 * 24 * 7
        }`;

        return html(<ChangeEmailForm email={user.email} />);
      },
      {
        body: t.Object({
          email: t.String({
            // regex
            pattern: "^[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+$",
          }),
        }),
      }
    )
    .post(
      "/change-metadata",
      async ({ body, html, auth, set, authJwt, db }) => {
        const metadata = body.metadata;

        if (!auth) {
          set.status = 401;
          redirectToError({
            set,
            code: "NOT_AUTHORIZED",
            message: "You are not authorized to do this",
          });
          return;
        }

        const newToken = await authJwt.sign({
          phone: auth.phone,
          email: auth.email,
          metadata,
        });

        const user = await db
          .update(verifiedUser)
          .set({ metadata })
          .where(eq(verifiedUser.phone, auth.phone))
          .returning()
          .get();

        set.headers[
          "set-cookie"
        ] = `auth_session=${newToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${
          60 * 60 * 24 * 7
        }`;

        return html(<ChangeMetadataForm metadata={user.metadata} />);
      },
      {
        body: t.Object({
          metadata: t.String(),
        }),
      }
    )
    .post(
      "/change-my-info",
      ({ store: { serverMetadata }, body: { myInfo } }) => {
        serverMetadata.info = myInfo;

        return <ChangeMyInfoForm myInfo={myInfo} />;
      },
      {
        body: t.Object({
          myInfo: t.String(),
        }),
      }
    )
    .post("/call-me", async ({ twilio, auth, set, db }) => {
      if (!auth) {
        set.status = 401;
        return "UNAUTHORIZED";
      }

      const limit = await threeCallsLimit(auth.phone);

      if (limit === "limit") {
        // set.status = 429;
        return "Limited to 3 calls (sorry!)";
      }

      const latestCall = await db.query.calls.findFirst({
        where: (call, { eq, and }) => and(eq(call.withPhone, auth.phone)),
        orderBy: (call, { desc }) => desc(call.createdAt),
      });

      if (latestCall && !canCallAgain(latestCall.status)) {
        if (!(latestCall.status === "queued")) {
          set.status = 429;
          return "ALREADY_CALLED";
        }
        // sus

        const secondCheck = await canCallAgainButFromTwilio(auth.phone);
        if (!secondCheck) {
          set.status = 429;
          return "ALREADY_CALLED";
        }
      }

      const call = await twilio.calls.create({
        url: `https://${Bun.env.BASE_URL}/transcribe`,
        to: "+818038565554",
        from: Bun.env.PHONE_NUMBER!,
        statusCallback: `https://${Bun.env.BASE_URL}/call-status`,
      });

      const today = new Date();
      await db
        .insert(calls)
        .values({
          withPhone: auth.phone,
          sid: call.sid,
          status: call.status,
          direction: "outbound-api",
          createdAt: today,
          updatedAt: today,
        })
        .run();

      return "Ask me to call you";
    })
    .post(
      "/verify-code",
      async ({ body, db, set, setCookie, authJwt, twilio }) => {
        const phone = body.phone;
        const code = body.code;
        const email = body.email;

        try {
          const { status } = await twilio.verify.v2
            .services(Bun.env.TWILIO_VERIFY_SERVICE_SID!)
            .verificationChecks.create({
              to: phone,
              code,
            });

          if (status !== "approved") {
            throw new Error("Invalid code");
          }

          const user = await db
            .insert(verifiedUser)
            .values({
              phone,
              email: email || null,
            })
            .onConflictDoUpdate({
              target: verifiedUser.phone,
              set: {
                email: email || null,
              },
            })
            .returning()
            .get();

          const token = await authJwt.sign({
            phone,
            email: email || null,
            metadata: user.metadata,
          });

          setCookie("auth_session", token, {
            httpOnly: true,
            maxAge: 7 * 86400,
          });

          set.redirect = "/";
        } catch (e) {
          console.log(e);
          redirectToError({
            set,
            code: "PHONE_CODE_ERROR",
            message: "The code is not valid",
          });
          return;
        }
      },
      {
        body: t.Object({
          phone: t.String(),
          code: t.String(),
          email: t.Optional(t.String()),
        }),
      }
    )
    .get("/logout", ({ set, removeCookie }) => {
      removeCookie("auth_session");
      set.redirect = "/";
    })
    .get("/connect", ({ auth, html }) => {
      if (!auth) {
        return html(<LeftPanel auth={auth} />);
      }

      return html(
        <div hx-ext="ws" ws-connect="/stream">
          <div hx-swap-oop="true" id="notification">
            New message
          </div>
          <form class="form-control" ws-send>
            <input type="text" name="message" class="input input-secondary" />
            <button type="submit">Send</button>
          </form>
        </div>
      );
    });

export const authMiddleware = (app: Elysia) =>
  app
    .use(dbPlugin)
    .derive(() => ({
      twilio: new Twilio.Twilio(
        Bun.env.TWILIO_ACCOUNT_SID,
        Bun.env.TWILIO_AUTH_TOKEN
      ),
    }))
    .use(cookie())
    .use(
      jwt({
        name: "authJwt",
        secret: Bun.env.AUTH_SECRET!,
        schema: t.Object({
          phone: t.String(),
          email: t.Union([t.String(), t.Null()], {
            default: null,
          }),
          metadata: t.Optional(t.String({ default: "" })),
        }),
      })
    )
    .derive(
      async ({
        cookie,
        authJwt,
        removeCookie,
      }): Promise<{ auth: Auth | null }> => {
        const auth = cookie.auth_session;
        if (!auth) {
          return {
            auth: null,
          };
        }

        const isOk = await authJwt.verify(auth);

        if (isOk === false) {
          removeCookie("auth_session");
          return {
            auth: null,
          };
        }

        return {
          auth: {
            phone: isOk.phone,
            email: isOk.email,
            metadata: isOk.metadata || "",
          },
        };
      }
    );

function ChangeEmailForm({ email = "" }: { email: string | null }) {
  return (
    <form
      hx-post="/change-email"
      class="form-control self-stretch"
      data-loading-path="/change-email"
    >
      <label for="change-email-input" class="label">
        <span class="label-text">
          Email (Originally: <strong>{email}</strong>)
        </span>
      </label>
      <div class="input-group">
        <input
          id="change-email-input"
          type="email"
          name="email"
          class="input input-primary grow"
          placeholder="Email (Optional)"
          value={email ?? ""}
        />
        <button
          type="submit"
          class="btn btn-primary"
          data-loading-class="btn-disabled"
          data-loading-class-remove="btn-primary"
          data-loading-disable
        >
          Change
        </button>
      </div>

      <label class="label">
        <span class="label-text">
          We will send you a call summary via email
        </span>
      </label>
    </form>
  );
}

function ChangeMetadataForm({ metadata = "" }: { metadata: string | null }) {
  return (
    <form
      hx-post="/change-metadata"
      class="form-control self-stretch"
      data-loading-path="/change-metadata"
    >
      <label for="change-metadata-input" class="label">
        <span class="label-text">Your info</span>
      </label>
      <div class="input-group input-group-vertical">
        <textarea
          id="change-metadata-input"
          name="metadata"
          class="textarea textarea-primary resize-none"
          placeholder="Your name, your company, etc."
        >
          {metadata ?? ""}
        </textarea>
        <button
          type="submit"
          class="btn btn-primary"
          data-loading-class="btn-disabled"
          data-loading-class-remove="btn-primary"
          data-loading-disable
        >
          Update
        </button>
      </div>
    </form>
  );
}

function ChangeMyInfoForm({ myInfo }: { myInfo: string }) {
  return (
    <form
      hx-post="/change-my-info"
      class="form-control self-stretch"
      data-loading-path="/change-my-info"
    >
      <label for="change-my-info-input" class="label">
        <span class="label-text">Quatton's info</span>
      </label>
      <div class="input-group input-group-vertical">
        <textarea
          id="change-my-info-input"
          name="myInfo"
          class="textarea textarea-primary resize-none"
          placeholder="Information about me"
        >
          {myInfo ?? ""}
        </textarea>
        <button
          type="submit"
          class="btn btn-primary"
          data-loading-class="btn-disabled"
          data-loading-class-remove="btn-primary"
          data-loading-disable
        >
          Update and See what happens 👀
        </button>
      </div>
      <label class="label grow">
        <span class="label-text">
          This information belongs to ME. Try writing "I have an appointment at
          3pm July 31st" I will be awared of the it during the call. This is to
          show how customizable this service is.
        </span>
      </label>
    </form>
  );
}

function LeftPanel({ auth }: { auth: Auth | null }) {
  return (
    <div
      class="flex flex-col items-center justify-between gap-8 prose dark:prose-invert"
      id="left-panel"
    >
      <div class="text-center">
        <h1 class="text-accent">{siteConfig.title}</h1>
        <h3 class="text-accent-content">{siteConfig.description}</h3>
      </div>
      <div class="space-y-1 text-center">
        <button
          class={`btn btn-accent`}
          data-loading-class="btn-disabled"
          data-loading-class-remove="btn-accent"
          data-loading-disable
          hx-post="/call-me"
          data-loading-path="/call-me"
          {...(!auth
            ? {
                disabled: "true",
              }
            : {})}
        >
          Ask me to call you
        </button>
        <p>International rates are insanely expensive. At your own risk.</p>
      </div>
      {!auth ? (
        <div class="w-96 max-w-full space-y-4">
          <ul>
            <li class="list-item"> Do you hate picking up the phone?</li>
            <li class="list-item">
              Are you busy with hundreds of phone calls a day?
            </li>
            <li class="list-item">
              {" "}
              Have you ever wished you could clone yourself?
            </li>
          </ul>
          <p>
            Well, although I can't clone your voice (yet), try calling me and
            see what happens. 👀
          </p>
        </div>
      ) : (
        <p class="text-center">
          Awaiting your call at
          <a href={`tel:${Bun.env.PHONE_NUMBER}`} class="link link-secondary">
            {Bun.env.PHONE_NUMBER}
          </a>
        </p>
      )}
    </div>
  );
}
