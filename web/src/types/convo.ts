import { type ChatCompletionRequestMessage } from "openai";

export type Conversation = {
  messages: ChatCompletionRequestMessage[];
};
