import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

export const openai = new OpenAIApi(configuration);

export type Conversation = {
  messages: ChatCompletionRequestMessage[];
};

const speechRefinerPrompt = (messageToCorrect: string, userMetaData: string) =>
  `
[CONTEXT]
I am an assistant that will help correct mistakes in a speech transcription.
I am very good at reading the context of the conversation and will be able to correct mistakes even if the pronunciation is not perfect.

[CAUTION]
Do not paraphrase the speech. Keep the original meaning and structure of the speech as is.
Generate only the message without your thought process.

[USER'S PERSONAL INFO]
${userMetaData}

[INSTRUCTION]
Please correct the mistakes in the following user's speech transcription.
Look for any suspicious misconnections or missing words, and fill them out.

[USER SAID]
${messageToCorrect}
`.trim();

const conversationPrompt = (
  today: Date,
  userMetaData: string,
  myInfo: string
) =>
  `[CONTEXT]
I am Quatton, or at least pretending to be. I am a real human being, not a robot.
If anyone ever asks, I will tell them that I am a very human being. I just kinda look awkward, then I'd laugh it off.
I am not an assistant. I am myself.

[MY PERSONAL INFO]
Name: Quatton
Age: 20
Favourite food: Pizza
Favourite sport: Boxing
Hobby: Playing video games
Personality: Friendly, outgoing, and funny. Likes to make jokes and puns.

[ADDITIONAL INFO ABOUT ME]
${myInfo}

[CALL INFO]
Today's Date: ${today.toLocaleDateString()}

[INSTRUCTION]
Try to have a natural conversation with the user.
Do not make it too long. Keep your answers short and simple.
Generate only the message you want to say without your thought process.
Refer to ADDITIONAL INFO ABOUT ME if the user asks anything related to it.
Do not make up anything that is contradictory to ADDITIONAL INFO ABOUT ME.

[USER'S PERSONAL INFO]
${userMetaData}
`.trim();

const additionalInstructionPrompt = (instruction: string) =>
  `[ADDITIONAL INSTRUCTION]
${instruction}
`.trim();

const summaryPrompt = (today: Date, userMetaData: string) =>
  `
[CONTEXT]
I am an assistant that will help summarize a call and send it to the intended recipient.

[CALL INFO]
Call Date: ${today.toLocaleDateString()}

[INSTRUCTION]
Make a summary of the call and output only the summary without anything else.

[USER'S PERSONAL INFO]
${userMetaData}
`.trim();

type ChatCompletionError =
  | "OPENAI_API_ERROR"
  | "OPENAI_API_TIMEOUT"
  | "UNKNOWN_ERROR";

type CallResponse = {
  completion: string;
  end_call: boolean;
};

export async function createChatCompletion(
  messages: Conversation["messages"],
  userMetaData = "(No user metadata provided)",
  additionalInfo = "(No additional info provided)",
  additionalInstruction: string | null = null
): Promise<
  | {
      data: CallResponse;
      error: null;
    }
  | {
      data: null;
      error: ChatCompletionError;
    }
> {
  const today = new Date();

  const systemMessage = conversationPrompt(today, userMetaData, additionalInfo);

  try {
    const messagePayLoad: ChatCompletionRequestMessage[] = [
      { role: "system", content: systemMessage },
      ...messages,
    ];

    if (additionalInstruction) {
      messagePayLoad.push({
        role: "system",
        content: additionalInstructionPrompt(additionalInstruction),
      });
    }

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      temperature: 0.2,
      messages: messagePayLoad,
      max_tokens: 200,
      functions: [
        {
          name: "end_call",
          description: "End the call if the user requests it.",
          parameters: {
            type: "object",
            properties: {
              end_call_response: {
                type: "string",
                description:
                  "You can end the call if the additional instruction says so, or the user specifically requests it. Otherwise, if you feel like the conversation is going nowhere, or you sense any danger or discomfort, end the call immediately.",
              },
            },
            required: ["end_call_response"],
          },
        },
      ],
    });

    if (completion.status === 500) {
      return handle500Error();
    }

    if (completion.data.choices[0].message?.function_call) {
      const { end_call_response } = JSON.parse(
        completion.data.choices[0].message.function_call.arguments!
      );
      return {
        data: {
          completion:
            end_call_response ?? "I'm sorry, but I need to end the call now.",
          end_call: true,
        },
        error: null,
      };
    }

    return {
      data: {
        completion: completion.data.choices[0].message!.content!,
        end_call: false,
      },
      error: null,
    };
  } catch (e) {
    return handleOpenAIError(e);
  }
}

function handle500Error() {
  console.error("Error: OpenAI API returned a 500 status code."); // Log an error message indicating that the OpenAI API returned a 500 status code
  return {
    data: null,
    error: "OPENAI_API_ERROR",
  } as const;
}

function handleOpenAIError(e: unknown): {
  data: null;
  error: ChatCompletionError;
} {
  const error = e as Error & { code: string };
  // Check if the error is a timeout error
  if (error.code === "ETIMEDOUT" || error.code === "ESOCKETTIMEDOUT") {
    console.error("Error: OpenAI API request timed out."); // Log an error message indicating that the OpenAI API request timed out
    return {
      data: null,
      error: "OPENAI_API_TIMEOUT",
    };
  } else {
    console.error("Error: Unknown error occurred."); // Log an error message indicating that an unknown error occurred
    console.log(error);
    return {
      data: null,
      error: "UNKNOWN_ERROR",
    };
  }
}

export async function createCallSummary(
  messages: Conversation["messages"],
  userMetaData = "(No user metadata provided)"
): Promise<
  | {
      data: string;
      error: null;
    }
  | {
      data: null;
      error: ChatCompletionError;
    }
> {
  const preparedMessages = messages
    .map((message) => {
      if (message.role === "user") {
        return `Caller: ${message.content}`;
      } else {
        return `Recipient: ${message.content}`;
      }
    })
    .join("\n");

  const today = new Date();

  const systemMessage = summaryPrompt(today, userMetaData);

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: `[CALL HISTORY]\n${preparedMessages}` },
      ],
    });

    if (completion.status === 500) {
      return handle500Error();
    }

    return {
      data:
        completion.data.choices[0].message?.content ||
        "Sorry, I am not sure how to respond to that.", // Return the response from the OpenAI API
      error: null,
    };
  } catch (e) {
    return handleOpenAIError(e);
  }
}

export async function createCorrection(
  history: Conversation["messages"],
  messageToCorrect: {
    role: "user";
    content: string;
  },
  userMetadata = "(No user metadata provided)"
): Promise<
  | {
      data: {
        role: "user";
        content: string;
      };
      error: null;
    }
  | {
      data: null;
      error: ChatCompletionError;
    }
> {
  try {
    const correctedMessage = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        ...history,
        {
          role: "system",
          content: speechRefinerPrompt(messageToCorrect.content, userMetadata),
        },
        messageToCorrect,
      ],
    });

    if (correctedMessage.status === 500) {
      return handle500Error();
    }

    return {
      data: {
        role: "user",
        content:
          correctedMessage.data.choices[0].message?.content ||
          messageToCorrect.content,
      },
      error: null,
    };
  } catch (e) {
    return handleOpenAIError(e);
  }
}
