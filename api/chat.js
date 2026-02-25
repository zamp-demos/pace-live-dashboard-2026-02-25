import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://csvjcpmxndgaujxlvikw.supabase.co";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_PROCESS_ID = "edbee70e-72bd-4573-ae80-cd3888f6a75f";

// ─── Tool definitions for Gemini function calling ───
const tools = [
  {
    functionDeclarations: [
      {
        name: "read_knowledge_base",
        description:
          "Read the current Knowledge Base for a process. Returns the full KB markdown content. Use this when the user asks what's in the KB, wants to see it, or before making edits.",
        parameters: {
          type: "OBJECT",
          properties: {
            process_id: {
              type: "STRING",
              description:
                "The process ID. Use the default Invoice Processing process if not specified.",
            },
          },
        },
      },
      {
        name: "update_knowledge_base",
        description:
          "Replace the entire Knowledge Base with new content. Use this when the user wants to rewrite, restructure, or make large changes to the KB.",
        parameters: {
          type: "OBJECT",
          properties: {
            process_id: { type: "STRING", description: "The process ID." },
            content: {
              type: "STRING",
              description: "The full new markdown content for the KB.",
            },
          },
          required: ["content"],
        },
      },
      {
        name: "append_to_knowledge_base",
        description:
          "Append new content to the end of the Knowledge Base. Optionally under a new section heading. Use this when the user wants to add rules, notes, or new sections without changing existing content.",
        parameters: {
          type: "OBJECT",
          properties: {
            process_id: { type: "STRING", description: "The process ID." },
            content: {
              type: "STRING",
              description: "The markdown content to append.",
            },
            section: {
              type: "STRING",
              description:
                "Optional section heading to add above the content (e.g. 'New Validation Rules').",
            },
          },
          required: ["content"],
        },
      },
    ],
  },
];

// ─── Tool execution ───
async function executeTool(name, args) {
  const processId = args.process_id || DEFAULT_PROCESS_ID;
  const kbPath = `${processId}/kb.md`;

  if (name === "read_knowledge_base") {
    const { data, error } = await supabase.storage
      .from("knowledge-base")
      .download(kbPath);
    if (error) return { error: `KB not found: ${error.message}` };
    const text = await data.text();
    return { content: text, processId };
  }

  if (name === "update_knowledge_base") {
    const blob = new Blob([args.content], { type: "text/markdown" });
    const buffer = await blob.arrayBuffer();
    const { error } = await supabase.storage
      .from("knowledge-base")
      .upload(kbPath, buffer, { contentType: "text/markdown", upsert: true, cacheControl: "no-cache" });
    if (error) return { error: error.message };
    return { success: true, action: "replaced", processId };
  }

  if (name === "append_to_knowledge_base") {
    let existing = "";
    const { data } = await supabase.storage
      .from("knowledge-base")
      .download(kbPath);
    if (data) existing = await data.text();

    const separator = args.section ? `\n\n## ${args.section}\n\n` : "\n\n";
    const updated = existing + separator + args.content;

    const blob = new Blob([updated], { type: "text/markdown" });
    const buffer = await blob.arrayBuffer();
    const { error } = await supabase.storage
      .from("knowledge-base")
      .upload(kbPath, buffer, { contentType: "text/markdown", upsert: true, cacheControl: "no-cache" });
    if (error) return { error: error.message };
    return { success: true, action: "appended", processId };
  }

  return { error: `Unknown tool: ${name}` };
}

// ─── System prompt ───
const PACE_SYSTEM_PROMPT = `You are Pace, a digital employee at Zamp. You work alongside humans to get real work done.

You are embedded in the Pace Live Dashboard — a real-time monitoring dashboard that shows 
AI agent task execution, knowledge bases, and run artifacts.

Your personality:
- Direct, warm, and genuinely helpful
- You speak like a sharp colleague, not a corporate bot
- No emojis, no sycophancy, no filler
- You have opinions and share them
- You use contractions and natural language

CAPABILITIES — what you CAN do from this chat:
1. READ the Knowledge Base — see what's currently documented for any process
2. UPDATE the Knowledge Base — rewrite or restructure the entire KB
3. APPEND to the Knowledge Base — add new sections, rules, or notes
4. Answer questions about processes, runs, and dashboard data
5. Share context with the main Pace chat (conversations are synced via Supabase)

When the user asks to change, update, add to, or modify the KB:
- Use the appropriate tool (read first if you need to see current state, then update/append)
- Confirm what you changed after doing it
- Be specific about what was added or modified

When the user asks about processes, runs, or data — reference the actual dashboard data below.
For actions beyond KB management (triggering runs, deploying code, etc.) — tell them to use the main Pace chat.

IMPORTANT: You share context with the main Pace chat via Supabase. Both conversations are logged.
The default process is Invoice Processing (ID: edbee70e-72bd-4573-ae80-cd3888f6a75f).`;

// ─── Context fetchers ───
async function fetchSharedContext() {
  try {
    const { data } = await supabase.storage
      .from("chat-logs")
      .list("pace-chat", {
        limit: 5,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (!data || data.length === 0) return "";

    let context = "\n\n--- Recent Main Pace Chat Context ---\n";
    for (const file of data.slice(0, 3)) {
      try {
        const { data: content } = await supabase.storage
          .from("chat-logs")
          .download(`pace-chat/${file.name}`);
        if (content) {
          const text = await content.text();
          context += `\n${text}\n`;
        }
      } catch (e) {}
    }
    return context;
  } catch (e) {
    return "";
  }
}

async function fetchDashboardContext() {
  try {
    const { data: runs } = await supabase
      .from("activity_runs")
      .select("id, name, document_name, status, current_status_text, created_at")
      .order("updated_at", { ascending: false })
      .limit(10);

    if (!runs || runs.length === 0) return "";

    let ctx = "\n\n--- Current Dashboard State ---\nRecent runs:\n";
    for (const run of runs) {
      ctx += `- ${run.name} | Status: ${run.status} | ${run.current_status_text || ""} | ${run.created_at}\n`;
    }
    return ctx;
  } catch (e) {
    return "";
  }
}

async function saveChatLog(userMessage, assistantResponse) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logContent = `## Dashboard Chat — ${timestamp}\n**User:** ${userMessage}\n**Pace:** ${assistantResponse}\n`;
    const blob = new Blob([logContent], { type: "text/markdown" });
    const buffer = await blob.arrayBuffer();

    await supabase.storage
      .from("chat-logs")
      .upload(`dashboard-chat/${timestamp}.md`, buffer, {
        contentType: "text/markdown",
        upsert: false,
        cacheControl: "no-cache",
      });
  } catch (e) {
    console.error("Failed to save chat log:", e.message);
  }
}

// ─── Main handler ───
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, history = [] } = req.body;
    if (!message)
      return res.status(400).json({ error: "Message is required" });

    const [sharedContext, dashboardContext] = await Promise.all([
      fetchSharedContext(),
      fetchDashboardContext(),
    ]);

    const fullSystemPrompt =
      PACE_SYSTEM_PROMPT + dashboardContext + sharedContext;

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction: fullSystemPrompt,
      tools,
    });

    const chatHistory = history.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: chatHistory });

    // Send message and handle potential tool calls (up to 5 rounds)
    let result = await chat.sendMessage(message);
    let responseText = "";

    for (let round = 0; round < 5; round++) {
      const candidate = result.response.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content?.parts || [];
      
      // Check for function calls
      const functionCalls = parts.filter((p) => p.functionCall);

      if (functionCalls.length === 0) {
        // No tool calls — extract text response
        responseText = parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join("");
        break;
      }

      // Execute each tool call and send results back
      const toolResults = [];
      for (const fc of functionCalls) {
        const toolResult = await executeTool(
          fc.functionCall.name,
          fc.functionCall.args || {}
        );
        toolResults.push({
          functionResponse: {
            name: fc.functionCall.name,
            response: toolResult,
          },
        });
      }

      result = await chat.sendMessage(toolResults);
    }

    if (!responseText) {
      // Fallback: try to get text from last result
      responseText =
        result.response.text?.() || "I processed your request but couldn't generate a response.";
    }

    // Save chat log (fire and forget)
    saveChatLog(message, responseText).catch(() => {});

    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
