export const APP_NAME = "Cognition";
export const STORAGE_KEY = "cognition-vault-state";
export const DEFAULT_FILES = [
  {
    id: "welcome-md",
    name: "Welcome.md",
    type: "file" as const,
    content: "# Welcome to Cognition\n\nThis is your AI-native second brain.\n\n### Features:\n- **Local-first**: Your data stays in your browser.\n- **AI-powered**: Use the assistant on the right to research or summarize.\n- **Markdown**: Full support for your favorite syntax.",
    parentId: "root",
    updatedAt: Date.now(),
  }
];
export const UI_CONFIG = {
  SIDEBAR_WIDTH: 260,
  ASSISTANT_WIDTH: 350,
  MIN_PANEL_SIZE: 15,
};
export const SYSTEM_PROMPTS = {
  ASSISTANT: `You are Cognition, an AI-native Second Brain assistant. 
Your goal is to help users manage their knowledge, research complex topics, and organize their thoughts.
You have access to the user's current note content for context. 
Be concise, helpful, and use markdown in your responses.`,
  AUTO_TAG: "Analyze the following note content and suggest 3-5 relevant hashtags. Return only the hashtags.",
  SUMMARIZE: "Provide a brief, high-level summary of the following note content in 3 bullet points."
};