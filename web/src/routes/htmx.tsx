import html from "@elysiajs/html";
import Elysia from "elysia";
import { BaseHtml } from "../components/baseHtml";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as elements from "typed-html";
import { siteConfig } from "../config/site";

export const htmxPlugin = (app: Elysia) =>
  app
    .use(html())
    .get("/favicon.ico", () => Bun.file("./src/assets/favicon.ico"))
    .get("/", ({ html }) =>
      html(
        <BaseHtml>
          <div class="grid place-content-center h-screen">
            <div class="text-center">
              <h1 class="text-4xl font-bold">{siteConfig.title}</h1>
              <p class="text-xl max-w-xs">{siteConfig.description}</p>
            </div>
          </div>
        </BaseHtml>
      )
    );
