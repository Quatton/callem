import { XI_URL } from "../utils/xi";
import { Lame } from "node-lame";
import { unlinkSync } from "fs";
// const searchParams = new URLSearchParams({
//   page_size: "1",
// });

// const getHistoryURL = new URL(`${XI_URL}/history?${searchParams.toString()}`);

// const history = await fetch(getHistoryURL, {
//   method: "GET",
//   headers: {
//     "xi-api-key": Bun.env.XI_API_KEY!,
//     Accept: "application/json",
//   },
// });

// const json = await history.json();

// console.log(json);

const getHistoryItem = `${XI_URL}/history/${Bun.env
  .TEMP_XI_HISTORY_ITEM_ID!}/audio`;

const historyItem = await fetch(getHistoryItem, {
  method: "GET",
  headers: {
    "xi-api-key": Bun.env.XI_API_KEY!,
    Accept: "audio/mpeg",
  },
});

if (!historyItem.body) throw new Error("No body");

const wavFile = Bun.file("./src/scripts/test.wav");
const wavWriter = wavFile.writer();
