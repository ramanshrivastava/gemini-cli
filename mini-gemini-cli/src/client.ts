/**
 * Basic Gemini API Client
 *
 * Wraps @google/generative-ai SDK to provide:
 * - Chat history management
 * - Simple message sending
 * - Type-safe Content handling
 *
 * This is a minimal implementation (~100 lines) compared to the real
 * GeminiChat class (200+ lines with retry logic, compression, etc.)
 *
 * Reference: packages/core/src/core/geminiChat.ts
 */

import { GoogleGenerativeAI, type Content } from '@google/generative-ai';

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;
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
   * This is a simplified version without:
   * - Streaming
   * - Function calling (Phase 1)
   * - Retry logic
   * - Error recovery
   */
  async sendMessage(text: string): Promise<string> {
    // Add user message to history
    const userMessage: Content = {
      role: 'user',
      parts: [{ text }],
    };

    // Generate content with history
    const model = this.genAI.getGenerativeModel({ model: this.model });
    const chat = model.startChat({
      history: this.history,
    });

    const result = await chat.sendMessage(text);
    const response = result.response;
    const responseText = response.text();

    // Update history
    this.history.push(userMessage);
    this.history.push({
      role: 'model',
      parts: [{ text: responseText }],
    });

    return responseText;
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
