import Elysia from "elysia";
import { db } from ".";

export const dbPlugin = (app: Elysia) => app.decorate("db", db);
