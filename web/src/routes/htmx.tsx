import html from "@elysiajs/html";
import Elysia, { t } from "elysia";
import { BaseHtml } from "../components/baseHtml";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as elements from "typed-html";
import { siteConfig } from "../config/site";
import Twilio from "twilio";
import { redirectToError } from "../utils/kinde";
import cookie from "@elysiajs/cookie";
import jwt from "@elysiajs/jwt";

export const htmxPlugin = (app: Elysia) =>
  app
    .use(html())
    .use(authMiddleware)
    .get("/favicon.ico", () => Bun.file("./src/assets/favicon.ico"))
    .get("/", ({ html, auth }) =>
      html(
        <BaseHtml>
          <div class="h-screen grid place-content-center">
            <div class="grid place-content-center grid-cols-1 sm:grid-cols-2 min-h-96 place-items-center gap-4">
              <div class="flex flex-col items-center justify-between gap-8 prose dark:prose-invert">
                <div class="text-center">
                  <h1>{siteConfig.title}</h1>
                  <h3 class="max-w-xs">{siteConfig.description}</h3>
                </div>
                <button
                  class={`btn ${!auth ? "btn-disabled" : "btn-accent"}`}
                  disabled={!auth ? "true" : "false"}
                >
                  Connect & Call
                </button>
                <div class="w-96 max-w-full space-y-4">
                  <ul>
                    <li class="list-item">
                      {" "}
                      Do you hate picking up the phone?
                    </li>
                    <li class="list-item">
                      Are you busy having tens of phone calls a day?
                    </li>
                    <li class="list-item">
                      {" "}
                      Have you ever wished you could clone yourself?
                    </li>
                  </ul>
                  <p>
                    Well, although I can't clone your voice (yet), try calling
                    me and see what happens. 👀
                  </p>
                </div>
              </div>
              <div class="row-span-2">
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
                    <p class="text-xl max-w-xs">You are logged in as</p>
                    <p class="text-xl max-w-xs">{auth.phone}</p>

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
            <div class="grid place-content-center place-items-center gap-4 h-screen">
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
      async ({ body, twilio, store: { phoneCodes }, set, html }) => {
        const phone = body.phone;
        const already = phoneCodes.get(phone);
        if (!already) {
          const code = Math.floor(Math.random() * 1000000)
            .toString()
            .padStart(6, "0");

          phoneCodes.set(phone, code.toString());
          phoneCodes = new Map(phoneCodes);

          try {
            await twilio.messages.create({
              from: Bun.env.PHONE_NUMBER,
              to: phone,
              body: `Your verification code is ${code}`,
            });

            console.log("Sent!");
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
          <form
            hx-post="/verify-code"
            class="form-control gap-2"
            hx-target="html"
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
      async ({
        body,
        html,
        auth,
        set,
        jwt,
        setCookie,
        store: { loggedInUsers },
      }) => {
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

        const newToken = await jwt.sign({ phone: auth.phone, email });

        loggedInUsers.set(newToken, { phone: auth.phone, email });
        loggedInUsers = new Map(loggedInUsers);

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
      async ({
        body,
        store: { phoneCodes, loggedInUsers },
        set,
        setCookie,
        jwt,
      }) => {
        const phone = body.phone;
        const code = body.code;
        const email = body.email;

        const already = phoneCodes.get(phone);
        if (already) {
          if (already === code) {
            phoneCodes.delete(phone);
            phoneCodes = new Map(phoneCodes);
            const token = await jwt.sign({ phone, email });
            loggedInUsers.set(token, { phone, email });
            loggedInUsers = new Map(loggedInUsers);

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
    );

export const authMiddleware = (app: Elysia) =>
  app
    .state("phoneCodes", new Map<string, string>())
    .state(
      "loggedInUsers",
      new Map<
        string,
        {
          phone: string;
          email?: string;
        }
      >()
    )
    .derive(() => ({
      twilio: new Twilio.Twilio(
        Bun.env.TWILIO_ACCOUNT_SID,
        Bun.env.TWILIO_AUTH_TOKEN
      ),
    }))
    .use(cookie())
    .use(
      jwt({
        name: "jwt",
        secret: Bun.env.AUTH_SECRET!,
        schema: t.Object({
          phone: t.String(),
          email: t.Optional(t.String()),
        }),
      })
    )
    .derive(async ({ cookie, jwt, removeCookie, store: { loggedInUsers } }) => {
      const auth = cookie.auth_session;
      const serverSyncedUser = loggedInUsers.get(auth);

      if (!auth) {
        if (serverSyncedUser) {
          loggedInUsers.delete(auth);
          loggedInUsers = new Map(loggedInUsers);
        }
        return {
          auth: null,
        };
      }

      const isOk = await jwt.verify(auth);

      if (isOk === false || !serverSyncedUser) {
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
    });

function ChangeEmailForm({ email = "" }: { email?: string }) {
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
        value={email}
      />
      <button type="submit" class="btn btn-primary">
        Change
      </button>
    </form>
  );
}
