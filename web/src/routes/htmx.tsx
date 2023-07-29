import html from "@elysiajs/html";
import Elysia, { t } from "elysia";
import { BaseHtml } from "../components/baseHtml";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as elements from "typed-html";
import { siteConfig } from "../config/site";
import cookie from "@elysiajs/cookie";
import {
  getAuthorizationUrl,
  getLogoutUrl,
  getUserAccessToken,
  redirectToError,
} from "../utils/kinde";

export const htmxPlugin = (app: Elysia) =>
  app
    .use(html())
    .use(authMiddleware)
    .get("/favicon.ico", () => Bun.file("./src/assets/favicon.ico"))
    .get("/", ({ html }) =>
      html(
        <BaseHtml>
          <div class="grid place-content-center place-items-center gap-4 h-screen">
            <div class="text-center">
              <h1 class="text-4xl font-bold">{siteConfig.title}</h1>
              <p class="text-xl max-w-xs">{siteConfig.description}</p>
            </div>

            <div hx-get="/dashboard" hx-trigger="load"></div>
          </div>
        </BaseHtml>
      )
    )
    .get("/dashboard", ({ html, accessToken }) =>
      html(
        <div>
          {accessToken ? (
            <div class="space-y-4">
              <h1>Dashboard</h1>
              <a href="/logout" class="btn btn-neutral">
                Logout
              </a>
            </div>
          ) : (
            <a href="/login" class="btn btn-primary">
              Login
            </a>
          )}
        </div>
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
    );

const authMiddleware = (app: Elysia) =>
  app
    .use(cookie())
    .derive(({ cookie, setCookie, removeCookie }) => ({
      accessToken: cookie.access_token,
      setAccessToken: (token: string, exp?: number) =>
        setCookie("access_token", token, {
          maxAge: exp ?? 60 * 60 * 24,
          sameSite: "lax",
          path: "/",
        }),
      removeAccessToken: () => removeCookie("access_token"),
    }))
    .get("/login", ({ set, setCookie }) => {
      const [url, state] = getAuthorizationUrl();
      setCookie("state", state, {
        maxAge: 60 * 60 * 24,
        sameSite: "lax",
        path: "/",
      });
      set.redirect = url;
    })
    .get(
      "/auth/callback",
      async ({ set, cookie, removeCookie, query, setCookie }) => {
        const savedState = cookie.state;
        if (!savedState) {
          redirectToError({
            code: "INVALID_STATE",
            message: "State cookie not set or expired",
            set,
          });
        }

        const { code, state } = query;

        if (state !== savedState) {
          redirectToError({
            code: "INVALID_STATE",
            message: "State mismatch",
            set,
          });
        }

        removeCookie("state");

        try {
          const { access_token: token } = await getUserAccessToken(code);
          setCookie("access_token", token);
          set.redirect = "/";
        } catch {
          redirectToError({
            code: "INVALID_CODE",
            message: "Invalid code",
            set,
          });
        }
      },
      {
        query: t.Object({
          code: t.String(),
          state: t.String(),
          scope: t.Optional(t.String()),
        }),
      }
    )
    .get("/logout", ({ set, removeAccessToken }) => {
      removeAccessToken();
      set.redirect = getLogoutUrl();
    });
