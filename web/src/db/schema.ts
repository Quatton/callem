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
  metadata: text("metadata").notNull().default(""),
  serverMetadata: text("server_metadata").notNull().default(""),
});

export type VerifiedUser = InferModel<typeof verifiedUser>;
export type Auth = Pick<VerifiedUser, "phone" | "email" | "metadata">;

export const phoneCodes = sqliteTable("phone_codes", {
  phone: text("phone").primaryKey(),
  code: text("code").notNull(),
  expires: integer("expires", {
    mode: "timestamp_ms",
  }).notNull(),
});

export const calls = sqliteTable("calls", {
  sid: text("sid").primaryKey(),
  withPhone: text("with_phone")
    .references(() => verifiedUser.phone)
    .notNull(),
  status: text("status", {
    enum: [
      "queued",
      "ringing",
      "in-progress",
      "completed",
      "busy",
      "failed",
      "canceled",
      "no-answer",
    ],
  }).notNull(),
  direction: text("direction", {
    enum: ["inbound", "outbound-api"],
  }).notNull(),
  callSummary: text("call_summary").notNull().default(""),
  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),
  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
});

export type Call = InferModel<typeof calls>;

export type PhoneCode = InferModel<typeof phoneCodes>;
