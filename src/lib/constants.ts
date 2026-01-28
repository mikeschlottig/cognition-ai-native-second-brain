export const APP_NAME = "Cognition";
/**
 * Multi-vault storage
 * - Registry is stored under a single well-known key.
 * - Each vault's data is stored under: `${STORAGE_KEY}${vaultId}`
 */
export const VAULTS_REGISTRY_KEY = "cognition-vault-registry";
export const STORAGE_KEY = "cognition-vault-data:";
export const DEFAULT_VAULT_ID = "default";
export const DEFAULT_FILES = [
  {
    id: "welcome-md",
    name: "Welcome.md",
    type: "file" as const,
    content:
      "# Welcome to Cognition\n\nThis is your AI-native second brain.\n\n### Features:\n- **Local-first**: Your data stays in your browser.\n- **AI-powered**: Use the assistant on the right to research or summarize.\n- **Markdown**: Full support for your favorite syntax.",
    parentId: "root",
    updatedAt: Date.now(),
  },
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
  AUTO_TAG: [
    `Generate **3–5** relevant hashtags for the note.`,
    `Rules:`,
    `- Return **ONLY** space-separated hashtags (markdown-friendly), e.g. "#productivity #knowledge-management"`,
    `- Use lowercase-kebab-case for multiword tags`,
    `- No bullets, no commas, no extra text`,
  ].join('\n'),
  SUMMARIZE: [
    `Summarize the note as a knowledge artifact.`,
    `Return:`,
    `- **Key takeaways**: 3 concise bullet points`,
    `- **Conceptual connections**: 2 bullets that link the ideas to related concepts or suggested notes (use [[Wiki Links]] when possible)`,
  ].join('\n'),
  VAULT_ANALYZE:
    "Analyze this vault as a knowledge base. Identify themes, gaps, and the most important next notes to create. Return: (1) Themes (3-6), (2) Missing links, (3) Suggested note titles (5-10).",
};