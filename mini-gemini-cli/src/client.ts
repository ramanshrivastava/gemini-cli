/**
 * Basic Gemini API Client
 *
 * Wraps @google/generative-ai SDK to provide:
 * - Chat history management
 * - Function calling support
 * - Type-safe Content handling
 *
 * This is a minimal implementation (~150 lines) compared to the real
 * GeminiChat class (200+ lines with retry logic, compression, etc.)
 *
 * Reference: packages/core/src/core/geminiChat.ts
 */

import {
  GoogleGenerativeAI,
  type Content,
  type FunctionDeclaration,
  type FunctionCall,
  type GenerateContentResult,
} from '@google/generative-ai';

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;
}

export interface ModelResponse {
  text?: string;
  functionCalls?: FunctionCall[];
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private history: Content[] = [];

  constructor(config: GeminiClientConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model ?? 'gemini-2.0-flash-exp';
  }

  /**
   * Send a message and get a response
   *
   * Now supports function calling (Phase 1)!
   *
   * @param text - User message
   * @param tools - Optional array of function declarations
   * @returns Response with text and/or function calls
   */
  async sendMessage(
    text: string,
    tools?: FunctionDeclaration[]
  ): Promise<ModelResponse> {
    // Add user message to history
    const userMessage: Content = {
      role: 'user',
      parts: [{ text }],
    };

    // Generate content with history and tools
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      ...(tools && {
        tools: [{ functionDeclarations: tools }],
      }),
    });

    const chat = model.startChat({
      history: this.history,
    });

    const result = await chat.sendMessage(text);
    const response = result.response;

    // Extract text and function calls
    const responseText = response.text();
    const functionCalls = response.functionCalls();

    // Update history
    this.history.push(userMessage);
    this.history.push({
      role: 'model',
      parts: response.candidates?.[0]?.content?.parts ?? [],
    });

    return {
      text: responseText || undefined,
      functionCalls: functionCalls || undefined,
    };
  }

  /**
   * Send function results back to the model
   *
   * After executing tools, send results back for the model
   * to generate a natural language response.
   *
   * @param functionResponses - Results from tool execution
   * @returns Model's response
   */
  async sendFunctionResults(
    functionResponses: Array<{
      name: string;
      response: Record<string, unknown>;
    }>,
    tools?: FunctionDeclaration[]
  ): Promise<ModelResponse> {
    // Add function responses to history
    const userMessage: Content = {
      role: 'user',
      parts: functionResponses.map((fr) => ({
        functionResponse: {
          name: fr.name,
          response: fr.response,
        },
      })),
    };

    // Generate content
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      ...(tools && {
        tools: [{ functionDeclarations: tools }],
      }),
    });

    const chat = model.startChat({
      history: this.history,
    });

    const result = await chat.sendMessage(userMessage.parts);
    const response = result.response;

    // Extract response
    const responseText = response.text();
    const functionCalls = response.functionCalls();

    // Update history
    this.history.push(userMessage);
    this.history.push({
      role: 'model',
      parts: response.candidates?.[0]?.content?.parts ?? [],
    });

    return {
      text: responseText || undefined,
      functionCalls: functionCalls || undefined,
    };
  }

  /**
   * Get conversation history
   */
  getHistory(): Content[] {
    return [...this.history]; // Return copy
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.history = [];
  }
}
