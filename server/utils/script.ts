import { MongoClient } from "mongodb";

const url = Deno.env.get("MONGO_DB_URL") || "mongodb://127.0.0.1:27018";
const mongoDBName = Deno.env.get("MONGO_DB_NAME") || "restofrigo";

const client = new MongoClient(url);

/**
 * Setup mongoDb indexes
 */
export async function setup_indexes() {
  console.log("setup_indexes");
  await client.connect();
  const database = client.db(mongoDBName);

  const recipesCollection = database.collection("recipes");
  const keysCollection = database.collection("keys");

  await recipesCollection.createIndex({
    promptHash: 1,
    threadId: 1,
    revision: 1,
  }, {
    unique: true,
  });

  await keysCollection.createIndex({
    key: 1,
  }, {
    unique: true,
  });

  await client.close();
  console.log("Setup completed.");
}

await setup_indexes();
