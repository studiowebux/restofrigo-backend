import z from "zod";

export const classificationSchema = z.object({
  meals: z.number()
    .int()
    .describe("Fetch the number of meals requested."),
  relevant: z
    .number()
    .int()
    .describe(
      `Classify how relevant the following statement is to cooking recipes and cooking ingredients on a scale from 1 to 5, where:
      1 = Highly relevant (directly related to cooking recipes or ingredients)
      5 = Completely irrelevant (not related to cooking or ingredients at all)
      Respond with just the number.`,
    ),
});
