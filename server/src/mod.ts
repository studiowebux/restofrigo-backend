import { Context, Hono } from "hono";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { bodyLimit } from "hono/body-limit";
import { bearerAuth } from "hono/bearer-auth";
import { HTTPException } from "hono/http-exception";

import { buildRecipeFromAST, parseRecipeMDToAST } from "./lib/ast/mod.ts";
import { hashIt } from "./lib/database.ts";

import { MongoService } from "./lib/database.ts";
import { classify, pokeAgent } from "./lib/langchain.ts";
import { millisToHuman } from "./lib/utils.ts";

await MongoService.init();

const customTimeoutException = (c: Context) =>
  new HTTPException(408, {
    message: `Request timeout after waiting ${
      c.header(
        "Duration",
      )
    } seconds. Please try again later.`,
  });

const server = new Hono();

server.use(compress());
server.use(logger());
server.use(cors());
server.use(requestId());

server.get("/usage", async (c: Context) => {
  const token = c.req.header("Authorization");
  if (!token) {
    throw new Error("Missing Authorization");
  }

  const usage = await MongoService.checkTokens(token);
  if (!usage) {
    throw new Error("No usage found");
  }

  if (usage.success) {
    return c.json({
      success: true,
      usage: `${usage.tokens}/${usage.dailyTokens}`,
      nextReset: millisToHuman(
        (24 * 60 * 60 * 1000) - (Date.now() - usage.lastReset),
      ),
    });
  }

  return c.json(usage, 400);
});

server.use(
  "*",
  bearerAuth({
    noAuthenticationHeaderMessage: "Missing API Key",
    invalidTokenMessage: "Invalid API Key",
    invalidAuthenticationHeaderMessage: "Invalid API Key",
    prefix: "",
    verifyToken: async (token: string, c: Context) => {
      try {
        const found = await MongoService.checkTokens(token);

        if (found.success && found?.tokens === 0) {
          c.set("response", "No more tokens left for the day.");
          return false;
        }

        if (found) {
          return true;
        }

        c.set("response", "Invalid API Key.");
        return false;
      } catch (e) {
        console.error(e);
        c.set("response", "Invalid API Key.");
        return false;
      }
    },
  }),
);

server.use("*", timeout(29000, customTimeoutException));

server.use(
  "*",
  bodyLimit({
    maxSize: 1024, // 1kb
    onError: (c) => {
      return c.text("Payload too large", 413);
    },
  }),
);

server.post(
  "/",
  async (c: Context) => {
    const { threadId, prompt, revision } = await c.req.json();

    const token = c.req.header("Authorization");
    if (!token) {
      throw new Error("Missing Authorization");
    }

    const hash = hashIt(prompt);
    const computedThreadId = `${token}_${threadId}_${revision}`;

    const caching = {
      promptHash: hash,
      threadId: computedThreadId,
      revision,
    };

    const cached = await MongoService.recipes.findOne(caching);

    if (cached) {
      return c.json({
        prompt,
        threadId,
        recipeMD: cached.recipeMD,
        recipeJSON: cached.recipeJSON,
        revision,
        cached: true,
        success: true,
      });
    }

    await MongoService.consumeToken(token);

    if (prompt.length > 300) {
      throw new Error(
        "Too many characters.",
      );
    }

    try {
      const response = await classify(prompt);

      if (response && response.relevant > 3) {
        throw new Error(
          "This application only answers cooking-related questions.",
        );
      }

      if (response && response.meals > 1) {
        throw new Error(
          "This application only support one meal at a time.",
        );
      }
    } catch (e) {
      if ((e as Error).message.includes("Failed to parse")) {
        throw new Error("Unable to process the message.");
      }
      throw e;
    }

    const answer = await pokeAgent({
      threadId: `${token}_${threadId}_${revision}`,
      content: prompt,
    });
    const ast = parseRecipeMDToAST(answer);
    const recipeJSON = buildRecipeFromAST(ast);

    try {
      await MongoService.recipes.insertOne({
        promptHash: hash,
        threadId: computedThreadId, // session id for memory
        prompt,
        recipeJSON,
        recipeMD: answer,
        createdAt: new Date(),
        createdBy: token || "Unknown",
        revision,
      });

      return c.json({
        prompt,
        threadId,
        recipeMD: answer,
        recipeJSON,
        revision,
        cached: false,
        success: true,
      });
    } catch (e) {
      throw (e as Error).message;
    }
  },
);

server.onError((err: Error, c: Context) => {
  console.error("GLOBAL ERROR HANDLING: ", err);
  console.error(err.stack);
  return c.json(
    { message: err.message || c.get("response"), success: false },
    (err as HTTPException).status || 500,
  );
});

Deno.serve({ port: 9992 }, server.fetch);
