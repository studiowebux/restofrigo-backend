import { parseArgs } from "jsr:@std/cli/parse-args";
import { MongoService } from "../src/lib/database.ts";

await MongoService.init();

const args: {
  _: [];
  email: string;
  tokens: number;
} = parseArgs(Deno.args);

if (!args.email) {
  console.error("Missing --email=");
  Deno.exit(1);
}

if (!args.tokens) {
  console.error("Missing --tokens=");
  Deno.exit(1);
}

const result = await MongoService.createApiKey(args.email, args.tokens);

console.log(result);
