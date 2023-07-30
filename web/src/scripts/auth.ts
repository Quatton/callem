import { db } from "../db";
import { phoneCodes } from "../db/schema";

const phone = "+818038565554";
const code = "616348";

await db
  .insert(phoneCodes)
  .values({
    phone,
    code,
    expires: new Date(Date.now() + 5 * 60 * 1000),
  })
  .run();
