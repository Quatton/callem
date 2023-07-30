import Elysia from "elysia";
import { db } from ".";

export const dbPlugin = (app: Elysia) =>
  app.decorate("db", db).state("serverMetadata", {
    info: "I have my own appointment at 8 pm July 31st.",
  });
