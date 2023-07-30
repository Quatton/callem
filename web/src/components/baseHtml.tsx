import elements from "typed-html";
import { siteConfig } from "../config/site";

export function BaseHtml({
  children,
  title = siteConfig.title,
}: elements.Children & {
  title?: string;
}) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://unpkg.com/htmx.org@1.9.4"></script>
    <script src="https://unpkg.com/hyperscript.org@0.9.9"></script>
    <script src="https://unpkg.com/htmx.org/dist/ext/ws.js"></script>
    <link href="/public/styles/globals.css" rel="stylesheet">

    <title>${title}</title>
    
  </head>
  <body>
    ${children}
  </body>
  </html>`;
}
