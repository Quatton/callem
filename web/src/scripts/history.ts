import { XI_URL } from "../utils/xi";
// const searchParams = new URLSearchParams({
//   page_size: "1",
// });

// const getHistoryURL = new URL(`${XI_URL}/history?${searchParams.toString()}`);

// const history = await fetch(getHistoryURL, {
//   method: "GET",
//   headers: {
//     "xi-api-key": process.env.XI_API_KEY!,
//     Accept: "application/json",
//   },
// });

// const json = await history.json();

// console.log(json);

const getHistoryItem = `${XI_URL}/history/${process.env
  .TEMP_XI_HISTORY_ITEM_ID!}/audio`;

const historyItem = await fetch(getHistoryItem, {
  method: "GET",
  headers: {
    "xi-api-key": process.env.XI_API_KEY!,
    Accept: "audio/mpeg",
  },
});

if (!historyItem.body) throw new Error("No body");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const wavFile = Bun.file("./src/scripts/test.wav");
