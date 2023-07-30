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
            <div class="grid place-content-center sm:grid-rows-2 sm:grid-cols-2 grid-flow-col place-items-center gap-4">
              <div class="text-center">
                <h1 class="text-4xl font-bold">{siteConfig.title}</h1>
                <p class="text-xl max-w-xs">{siteConfig.description}</p>
              </div>
              <div class="text-center max-w-sm space-y-4">
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
              </div>
              <div class="row-span-2">
                {!auth ? (
                  <form hx-post="/verify-phone">
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

                    <span>
                      Awaiting your call at:{" "}
                      <a
                        href={`tel:${Bun.env.PHONE_NUMBER}`}
                        class="link link-secondary"
                      >
                        {Bun.env.PHONE_NUMBER}
                      </a>
                    </span>

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
            console.error(e);
            redirectToError({
              set,
              code: "PHONE_CODE_ERROR",
              message: "Something went wrong with Twilio",
            });
          }
        }

        return html(
          <form hx-post="/verify-code">
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
      async ({ body, html, auth, set, jwt, setCookie }) => {
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
      async ({ body, store: { phoneCodes }, set, setCookie, jwt }) => {
        const phone = body.phone;
        const code = body.code;
        const email = body.email;

        const already = phoneCodes.get(phone);
        if (already) {
          if (already === code) {
            phoneCodes.delete(phone);
            setCookie("auth_session", await jwt.sign({ phone, email }), {
              httpOnly: true,
              maxAge: 7 * 86400,
            });
            return;
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

const authMiddleware = (app: Elysia) =>
  app
    .state("phoneCodes", new Map<string, string>())

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
    .derive(async ({ cookie, jwt, removeCookie }) => {
      const auth = cookie.auth_session;

      if (!auth) {
        return {
          auth: null,
        };
      }

      const isOk = await jwt.verify(auth);

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
