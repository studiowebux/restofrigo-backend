export interface Position {
  line: number;
  column: number;
}

type Amount = {
  quantity: string;
  unit: string;
  raw: string;
};

export interface Ingredient {
  amount?: string;
  unit?: string;
  name: string;
  rawAmount: string;
}

export interface Recipe {
  title: string;
  description?: string;
  tags: string[];
  yield?: Amount[];
  ingredients: Ingredient[];
  directions: string[];
}

export type ASTNode =
  | { type: "Title"; content: string; position: Position }
  | { type: "Description"; content: string; position: Position }
  | { type: "Tags"; tags: string[]; position: Position }
  | {
    type: "Yield";
    yields: Amount[];
    position: Position;
  }
  | { type: "Separator"; position: Position }
  | {
    type: "Ingredient";
    amount: Amount;
    name: string;
    position: Position;
  }
  | { type: "Direction"; content: string; position: Position }
  | { type: "Unknown"; raw: string; position: Position };

function cleanInstruction(line: string): string {
  return line
    .replace(/^\s*[-*]\s+/, "") // Remove bullet markers like `- ` or `* `
    .replace(/^\s*\d+\.\s+/, "") // Remove numbered list prefixes like `1. `, `10. `
    .trim();
}

export function parseRecipeMDToAST(input: string): ASTNode[] {
  const lines = input.split(/\r?\n/);
  const ast: ASTNode[] = [];

  let state: "head" | "ingredients" | "directions" = "head";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const position = { line: i + 1, column: 1 };

    if (line === "") {
      continue;
    }

    if (line.startsWith("```markdown")) {
      continue;
    }

    if (line === ("```")) {
      continue;
    }

    if (line.startsWith("# ")) {
      ast.push({ type: "Title", content: line.slice(2).trim(), position });
    } else if (
      line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")
    ) {
      const tags = line
        .slice(1, -1)
        .split(",")
        .map((tag) => tag.trim());
      ast.push({ type: "Tags", tags, position });
    } else if (line.startsWith("**") && line.endsWith("**")) {
      const yieldText = line.slice(2, -2).trim();
      const entries = yieldText.split(",").map((e) => e.trim());

      const yields: Amount[] = entries.map((raw) => {
        const match = raw.match(/^(\d+(?:[./\s]*\d*)?)\s*(.+)$/);
        if (match) {
          return {
            quantity: match[1].trim(),
            unit: match[2].trim(),
            raw,
          };
        } else {
          return {
            quantity: "",
            unit: raw,
            raw,
          };
        }
      });

      ast.push({
        type: "Yield",
        yields,
        position,
      });
    } else if (line === "---") {
      if (state === "head") {
        state = "ingredients";
      } else if (state === "ingredients") {
        state = "directions";
      }
      ast.push({ type: "Separator", position });
    } else if (state === "head") {
      ast.push({ type: "Description", content: line, position });
    } else if (line.startsWith("### Ingredients")) {
      state = "ingredients";
    } else if (line.startsWith("### Instructions")) {
      state = "directions";
    } else if (state === "ingredients") {
      if (line.startsWith("- *") && /\d/.test(line)) {
        const end = line.indexOf("*", 3);
        const rawAmount = line.slice(3, end).trim();
        const name = line.slice(end + 1).trim();

        // Split and parse the rawAmount into quantity and unit
        const amountParts = rawAmount.split(/\s+/);

        let quantity = "";
        let unit = "";

        if (amountParts.length === 1) {
          if (/^[\d./]+$/.test(amountParts[0])) {
            quantity = amountParts[0];
          } else {
            unit = amountParts[0];
          }
        } else if (amountParts.length >= 2) {
          const firstIsNumber = /^[\d./]+$/.test(amountParts[0]);
          const secondIsNumber = /^[\d./]+$/.test(amountParts[1]);

          if (firstIsNumber && secondIsNumber) {
            quantity = amountParts.slice(0, 2).join(" ");
            unit = amountParts.slice(2).join(" ");
          } else if (firstIsNumber) {
            quantity = amountParts[0];
            unit = amountParts.slice(1).join(" ");
          } else {
            unit = rawAmount;
          }
        }

        const amount = {
          quantity,
          unit,
          raw: rawAmount,
        };

        ast.push({
          type: "Ingredient",
          amount,
          name,
          position,
        });
      } else if (line.startsWith("- ")) {
        // Fallback for unstructured ingredients like "A pinch of salt"
        const name = line.slice(2).trim();

        ast.push({
          type: "Ingredient",
          amount: {
            quantity: "",
            unit: "",
            raw: "",
          },
          name,
          position,
        });
      } else {
        console.debug(line, "SKIPPED");
      }
    } else if (state === "directions") {
      if (line.startsWith("###")) {
        // skip headings inside instructions
        continue;
      }

      // normal instruction parsing here
      ast.push({
        type: "Direction",
        content: cleanInstruction(line.trim()),
        position,
      });
    } else {
      ast.push({ type: "Unknown", raw: line, position });
    }
  }

  return ast;
}

export function buildRecipeFromAST(ast: ASTNode[]): Recipe {
  const recipe: Recipe = {
    title: "",
    tags: [],
    ingredients: [],
    directions: [],
  };

  for (const node of ast) {
    switch (node.type) {
      case "Title":
        recipe.title = node.content.trim();
        break;
      case "Description":
        recipe.description = (recipe.description?.trim() ?? "") +
          node.content.trim() +
          "\n";
        break;
      case "Tags":
        recipe.tags = node.tags.map((tag) => tag.trim());
        break;
      case "Yield":
        recipe.yield = node.yields;
        break;
      case "Ingredient":
        recipe.ingredients.push({
          amount: node.amount.quantity,
          unit: node.amount.unit,
          rawAmount: node.amount.raw,
          name: node.name,
        });
        break;
      case "Direction":
        recipe.directions.push(node.content.trim());
        break;
    }
  }

  if (recipe.description) {
    recipe.description = recipe.description.trim();
  }

  return recipe;
}
