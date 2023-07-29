import { unlinkSync } from "fs";
import { textToSpeechStream, toTempFile } from "../utils/xi";

// const transcribed = await textToSpeechStream("But what if I overwrite it?");
// await toTempFile(transcribed, "test");

unlinkSync("./src/public/audio/CAe91d3fb0bfe033f1fa77403c67d67771.mp3");
