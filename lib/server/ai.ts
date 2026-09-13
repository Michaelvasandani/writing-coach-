import { generateText, Output } from "ai";
import type { ZodType } from "zod";

export async function runContract<T>(schema: ZodType<T>, system: string, payload: unknown, modelEnv: string, fallbackModel: string): Promise<T> {
  if (!process.env.AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is not configured");
  const result = await generateText({
    model: process.env[modelEnv] || process.env.COACH_MODEL || fallbackModel,
    reasoning: "low",
    output: Output.object({ schema }),
    system,
    prompt: JSON.stringify(payload)
  });
  return result.output;
}
