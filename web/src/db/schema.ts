import { InferModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const verifiedUser = sqliteTable("verified_user", {
  phone: text("phone").primaryKey(),
  email: text("email"),
  doNotSendEmail: integer("do_not_send_email", {
    mode: "boolean",
  })
    .default(false)
    .notNull(),
});

export type VerifiedUser = InferModel<typeof verifiedUser>;
export type Auth = Pick<VerifiedUser, "phone" | "email">;

export const phoneCodes = sqliteTable("phone_codes", {
  phone: text("phone").primaryKey(),
  code: text("code").notNull(),
  expires: integer("expires", {
    mode: "timestamp_ms",
  }).notNull(),
});

export type PhoneCode = InferModel<typeof phoneCodes>;
