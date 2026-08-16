import dotenv from 'dotenv';
import { HfInference } from '@huggingface/inference';

dotenv.config();

export class LLMService {
  public async *streamRagResponse(
    userQuery: string,
    contextStr?: string | null,
    systemInstruction?: string | null
  ): AsyncGenerator<string, void, unknown> {
    dotenv.config();

    const hfToken = (process.env.HUGGINGFACEHUB_API_TOKEN || '').trim();
    const hfModel = (
      process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-7B-Instruct'
    ).trim();

    const defaultSystem =
      'You are an expert AI assistant answering questions STRICTLY based on the provided PDF document excerpts.\n' +
      'Instructions:\n' +
      '1. Answer the question accurately using ONLY the information in the Document Context.\n' +
      '2. If the context does not contain enough information to answer, politely respond: ' +
      "'I could not find the answer to that question in the uploaded PDF.'\n" +
      '3. Cite source page numbers when referencing specific details.\n' +
      '4. Output ONLY your final answer. Do NOT output prompt instructions or context blocks.';

    const systemText = systemInstruction || defaultSystem;

    let userContent = userQuery;
    if (contextStr) {
      userContent = `DOCUMENT CONTEXT:\n${contextStr}\n\nUSER QUESTION: ${userQuery}`;
    }

    const messages = [
      { role: 'system' as const, content: systemText },
      { role: 'user' as const, content: userContent },
    ];

    if (hfToken) {
      try {
        const client = new HfInference(hfToken);
        const stream = client.chatCompletionStream({
          model: hfModel,
          messages: messages,
          max_tokens: 800,
        });

        for await (const chunk of stream) {
          if (
            chunk.choices &&
            chunk.choices[0] &&
            chunk.choices[0].delta &&
            chunk.choices[0].delta.content
          ) {
            const token = chunk.choices[0].delta.content;
            yield token;
          }
        }
        return;
      } catch (err: any) {
        yield `[Hugging Face Model Error: ${err?.message || err}]\n\n`;
      }
    }

    // Fallback: Clean mock response stream if API key is unconfigured or fails
    yield* this.streamMockResponse(userQuery);
  }

  private async *streamMockResponse(userQuery: string): AsyncGenerator<string, void, unknown> {
    const mockResponse =
      `Regarding your question ('${userQuery}'): ` +
      'The Hugging Face model response engine is ready. ' +
      'To connect live Hugging Face cloud models, verify `HUGGINGFACEHUB_API_TOKEN` in `backend_nodejs/.env`.';

    const words = mockResponse.split(' ');
    for (let i = 0; i < words.length; i++) {
      const suffix = i < words.length - 1 ? ' ' : '';
      yield words[i] + suffix;
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}

export const llmService = new LLMService();
