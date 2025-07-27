import { ChatOpenAI } from "npm:@langchain/openai@0.5.18";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";

import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import { MongoDBChatMessageHistory } from "@langchain/mongodb";

import { PROMPT2 } from "../constant/prompt.ts";
import { classificationSchema } from "../schemas/classifier.ts";
import { MongoService } from "./database.ts";

const classifierModel = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
  maxRetries: 1,
  verbose: false,
});

const recipeModel = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0,
  maxRetries: 1,
  verbose: false,
});

const prompt = PromptTemplate.fromTemplate(`${PROMPT2}

  Current conversation:
  {history}
  Human: {input}
  AI:`);

export async function pokeAgent(
  { threadId, content }: { threadId: string; content: string },
) {
  const memory = new BufferMemory({
    chatHistory: new MongoDBChatMessageHistory({
      collection: MongoService.history,
      sessionId: threadId,
    }),
  });
  const chain = new ConversationChain({ llm: recipeModel, memory, prompt });

  const result = await chain.invoke({ input: content });
  return result.response as string;
}

const taggingPrompt = ChatPromptTemplate.fromTemplate(
  `Extract the desired information from the following message.

Only extract the properties mentioned in the 'Classification' function.

Message:
{input}
`,
);

const llmWithStructuredOutput = classifierModel.withStructuredOutput(
  classificationSchema,
  { name: "extractor" },
);

export async function classify(content: string) {
  const prompt = await taggingPrompt.invoke({
    input: content.trim().replace(/\n/g, ","), // removes enter to fix the
  });
  return await llmWithStructuredOutput.invoke(prompt);
}
