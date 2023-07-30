import html from "@elysiajs/html";
import Elysia, { t } from "elysia";
import { BaseHtml } from "../components/baseHtml";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as elements from "typed-html";
import { siteConfig } from "../config/site";
import Twilio from "twilio";
import { isWithinExpiration, redirectToError } from "../utils/auth";
import cookie from "@elysiajs/cookie";
import jwt from "@elysiajs/jwt";
import { phoneCodes, type Auth, verifiedUser } from "../db/schema";
import { dbPlugin } from "../db/dbPlugin";
import { eq } from "drizzle-orm";

export const htmxPlugin = (app: Elysia) =>
  app
    .use(html())
    .use(authMiddleware)
    .use(dbPlugin)
    .get("/favicon.ico", () => Bun.file("./src/assets/favicon.ico"))
    .get("/", ({ html, auth }) =>
      html(
        <BaseHtml>
          <div class="min-h-screen grid place-content-center py-8">
            <div class="grid place-content-center grid-cols-1 sm:grid-cols-2 min-h-96 place-items-center gap-4">
              <LeftPanel auth={auth} />
              <div>
                {!auth ? (
                  <form hx-post="/verify-phone" class="form-control gap-2">
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
                    <button type="submit" class="btn btn-primary">
                      Verify
                    </button>
                  </form>
                ) : (
                  <div class="text-center flex flex-col items-center gap-4">
                    <h1 class="text-4xl font-bold">Welcome</h1>
                    <span class="space-x-1">
                      <span class="text-xl max-w-xs">You are logged in as</span>
                      <span class="text-xl max-w-xs">{auth.phone}</span>
                      <a href="/logout" class="btn btn-error">
                        Logout
                      </a>
                    </span>

                    <p>
                      Awaiting your call at
                      <a
                        href={`tel:${Bun.env.PHONE_NUMBER}`}
                        class="link link-secondary"
                      >
                        {Bun.env.PHONE_NUMBER}
                      </a>
                    </p>

                    <p>
                      Optionally, you can ask us to send you the call summary
                      via email.
                    </p>

                    <ChangeEmailForm email={auth.email} />
                  </div>
                )}
              </div>
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
          const code = Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, "0");

          try {
            await twilio.messages.create({
              from: Bun.env.PHONE_NUMBER,
              to: phone,
              body: `Your verification code is ${code}`,
            });
            const expires = new Date(Date.now() + 5 * 60 * 1000);
            await db
              .insert(phoneCodes)
              .values({
                phone,
                code,
                expires,
              })
              .onConflictDoUpdate({
                target: phoneCodes.phone,
                set: {
                  code,
                  expires,
                },
              })
              .run();
          } catch (e) {
            redirectToError({
              set,
              code: "PHONE_CODE_ERROR",
              message: "Cannot send the code to" + phone,
            });
            return;
          }
        }

        return html(
          <form action="/verify-code" method="POST" class="form-control gap-2">
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
            <button type="submit" class="btn btn-primary">
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
      async ({ body, html, auth, set, authJwt, setCookie }) => {
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

        const newToken = await authJwt.sign({ phone: auth.phone, email });

        setCookie("auth_session", newToken, {
          httpOnly: true,
          maxAge: 7 * 86400,
        });

        return html(<ChangeEmailForm email={auth.email} />);
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
      "/verify-code",
      async ({ body, db, set, setCookie, authJwt }) => {
        const phone = body.phone;
        const code = body.code;
        const email = body.email;

        const already = await db
          .delete(phoneCodes)
          .where(eq(phoneCodes.phone, phone))
          .returning()
          .get();

        if (already && isWithinExpiration(already.expires)) {
          const alreadyCode = already.code;
          if (alreadyCode === code) {
            const user = await db
              .insert(verifiedUser)
              .values({ phone, email })
              .onConflictDoUpdate({
                target: verifiedUser.phone,
                set: {
                  email: email,
                },
              })
              .returning()
              .get();

            if (!user) {
              redirectToError({
                set,
                code: "CREATE_USER_ERROR",
                message: "Cannot create a user",
              });
              return;
            }

            const token = await authJwt.sign({ phone, email: email || null });
            setCookie("auth_session", token, {
              httpOnly: true,
              maxAge: 7 * 86400,
            });

            set.redirect = "/";
          } else {
            redirectToError({
              set,
              code: "PHONE_CODE_ERROR",
              message: "The code is incorrect",
            });
          }
        } else {
          redirectToError({
            set,
            code: "PHONE_CODE_ERROR",
            message: "The code is incorrect",
          });
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
          },
        };
      }
    );

function ChangeEmailForm({ email = "" }: { email: string | null }) {
  return (
    <form hx-post="/change-email" class="form-control gap-2">
      <label for="change-email-input" class="label">
        Email (Originally: <strong>{email}</strong>)
      </label>
      <input
        id="change-email-input"
        type="email"
        name="email"
        class="input input-primary"
        placeholder="Email (Optional)"
        value={email ?? ""}
      />
      <button type="submit" class="btn btn-primary">
        Change
      </button>
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
        <h1>{siteConfig.title}</h1>
        <h3 class="max-w-xs">{siteConfig.description}</h3>
      </div>
      <button class={`btn btn-disabled`} disabled="true">
        Call me (Coming soon)
      </button>
      {!auth ? (
        <div class="w-96 max-w-full space-y-4">
          <ul>
            <li class="list-item"> Do you hate picking up the phone?</li>
            <li class="list-item">
              Are you busy having tens of phone calls a day?
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
      ) : null}
    </div>
  );
}
