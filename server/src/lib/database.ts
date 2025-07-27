import { createHash, randomBytes } from "node:crypto";
import { Collection, Db, MongoClient } from "mongodb";
import { Recipe } from "./ast/mod.ts";

// Docker: `docker run -d -p 27018:27017 --name restofrigo mongo`
const mongoDbUrl = Deno.env.get("MONGO_DB_URL") || "mongodb://127.0.0.1:27018";
const mongoDbName = Deno.env.get("MONGO_DB_NAME") || "restofrigo";

export type RecipeModel = {
  threadId: string;
  promptHash: string;
  prompt: string;
  recipeJSON: Recipe;
  recipeMD: string;
  createdAt: Date;
  createdBy: string;
  revision: number;
};

export type ApiKeyModel = {
  email: string;
  key: string;
  tokens: number;
  lastReset: number;
  dailyTokens: number;
};

export function hashIt(input: string) {
  return createHash("sha1").update(input).digest("hex");
}

export class MongoService {
  private static client: MongoClient;
  private static db: Db;

  static async init() {
    if (!MongoService.client) {
      MongoService.client = new MongoClient(mongoDbUrl);
      await MongoService.client.connect();
      MongoService.db = MongoService.client.db(mongoDbName);
      console.info("MongoDB connected:", await MongoService.db.stats());
    }
  }

  static get history(): Collection<any> {
    return MongoService.db.collection("history");
  }

  static get recipes(): Collection<RecipeModel> {
    return MongoService.db.collection("recipes");
  }

  static get keys(): Collection<ApiKeyModel> {
    return MongoService.db.collection("keys");
  }

  static async close() {
    await MongoService.client?.close();
  }

  static async checkTokens(
    apiKey: string,
  ): Promise<
    { success: false; error: string } | ApiKeyModel & { success: true }
  > {
    const now = Date.now();

    const doc = await this.keys.findOne({ key: apiKey });

    if (!doc) {
      // DO NOT create the key — manual key creation enforced
      return { success: false, error: "Invalid API key" };
    }

    const hoursSinceReset = (now - doc.lastReset) / (1000 * 60 * 60);
    let tokens = doc.tokens;
    const updateFields: Partial<ApiKeyModel> = {};

    if (hoursSinceReset >= 24) {
      tokens = doc.dailyTokens;
      updateFields.lastReset = now;
      updateFields.tokens = tokens;
    }

    if (tokens <= 0) {
      return { success: false, error: "Rate limit exceeded. Try again later." };
    }

    const result = await this.keys.updateOne(
      { key: apiKey },
      { $set: updateFields },
      { upsert: false }, // ensure we never insert a new key
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "API key not found or update failed." };
    }

    return { success: true, ...doc };
  }

  static async consumeToken(apiKey: string) {
    const now = Date.now();

    const doc = await this.keys.findOne({ key: apiKey });

    if (!doc) {
      // DO NOT create the key — manual key creation enforced
      return { success: false, error: "Invalid API key" };
    }

    const hoursSinceReset = (now - doc.lastReset) / (1000 * 60 * 60);
    let tokens = doc.tokens;
    const updateFields: Partial<ApiKeyModel> = {};

    if (hoursSinceReset >= 24) {
      tokens = doc.dailyTokens;
      updateFields.lastReset = now;
    }

    if (tokens <= 0) {
      return { success: false, error: "Rate limit exceeded. Try again later." };
    }

    updateFields.tokens = tokens - 1;

    const result = await this.keys.updateOne(
      { key: apiKey },
      { $set: updateFields },
      { upsert: false }, // ensure we never insert a new key
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "API key not found or update failed." };
    }

    return { success: true, tokensLeft: updateFields.tokens };
  }

  static async createApiKey(email: string, dailyTokens = 100) {
    const existing = await this.keys.findOne({ email });

    if (existing) {
      return {
        success: false,
        error: "API key already exists for this email.",
      };
    }

    const key = randomBytes(24).toString("hex"); // 48-char key

    const now = Date.now();

    const newKey: ApiKeyModel = {
      email,
      key,
      tokens: dailyTokens,
      lastReset: now,
      dailyTokens,
    };

    const result = await this.keys.insertOne(newKey);

    if (!result.insertedId) {
      return { success: false, error: "Failed to insert API key." };
    }

    return { success: true, apiKey: key };
  }
}
