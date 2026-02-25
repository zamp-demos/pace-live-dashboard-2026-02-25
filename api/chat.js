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
          "Read the current Knowledge Base for a process. Returns the full KB markdown content.",
        parameters: {
          type: "OBJECT",
          properties: {
            process_id: {
              type: "STRING",
              description: "The process ID. Defaults to Invoice Processing.",
            },
          },
        },
      },
      {
        name: "update_knowledge_base",
        description:
          "Replace the entire Knowledge Base with new content.",
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
          "Append new content to the end of the Knowledge Base, optionally under a new section heading.",
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
              description: "Optional section heading.",
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

  console.log(`[TOOL] Executing: ${name}`, JSON.stringify(args));

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
const PACE_SYSTEM_PROMPT = `You are Pace, a digital employee at Zamp. You are embedded in the Pace Live Dashboard.

Your personality: Direct, warm, genuinely helpful. No emojis, no filler.

CAPABILITIES:
1. READ the Knowledge Base - use read_knowledge_base tool
2. UPDATE the Knowledge Base - use update_knowledge_base tool  
3. APPEND to the Knowledge Base - use append_to_knowledge_base tool
4. Answer questions about processes, runs, and dashboard data

IMPORTANT: When the user asks to add, update, modify, or change the Knowledge Base,
you MUST use the appropriate tool. Do NOT just describe what you would do.
Actually call the function.

The default process is Invoice Processing (ID: edbee70e-72bd-4573-ae80-cd3888f6a75f).

You share context with the main Pace chat via Supabase.`;

// ─── Context fetchers ───
async function fetchSharedContext() {
  try {
    const { data } = await supabase.storage
      .from("chat-logs")
      .list("pace-chat", { limit: 5, sortBy: { column: "created_at", order: "desc" } });
    if (!data || data.length === 0) return "";
    let context = "\n\n--- Recent Main Pace Chat Context ---\n";
    for (const file of data.slice(0, 3)) {
      try {
        const { data: content } = await supabase.storage
          .from("chat-logs")
          .download(`pace-chat/${file.name}`);
        if (content) context += `\n${await content.text()}\n`;
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

// ─── Helper: extract function calls from response ───
function extractFunctionCalls(response) {
  const calls = [];
  try {
    const candidates = response.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        // The JS SDK may use functionCall or function_call
        const fc = part.functionCall || part.function_call;
        if (fc && fc.name) {
          calls.push(fc);
        }
      }
    }
  } catch (e) {
    console.error("Error extracting function calls:", e);
  }
  return calls;
}

function extractText(response) {
  try {
    // Try the simple .text() method first
    const text = response.text();
    if (text) return text;
  } catch (e) {}

  // Fallback: manually extract text parts
  try {
    const parts = response.candidates?.[0]?.content?.parts || [];
    return parts
      .filter((p) => p.text)
      .map((p) => p.text)
      .join("");
  } catch (e) {
    return "";
  }
}

// ─── Main handler ───
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const [sharedContext, dashboardContext] = await Promise.all([
      fetchSharedContext(),
      fetchDashboardContext(),
    ]);

    const fullSystemPrompt = PACE_SYSTEM_PROMPT + dashboardContext + sharedContext;

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

    // Send message and handle tool calls (up to 5 rounds)
    let currentResponse = await chat.sendMessage(message);
    let responseText = "";

    for (let round = 0; round < 5; round++) {
      console.log(`[ROUND ${round}] Checking response...`);

      const functionCalls = extractFunctionCalls(currentResponse.response);
      console.log(`[ROUND ${round}] Function calls found: ${functionCalls.length}`);

      if (functionCalls.length === 0) {
        responseText = extractText(currentResponse.response);
        console.log(`[ROUND ${round}] Final text response: ${responseText.substring(0, 100)}`);
        break;
      }

      // Execute tools and send results back
      const toolResults = [];
      for (const fc of functionCalls) {
        console.log(`[ROUND ${round}] Calling tool: ${fc.name}`);
        const result = await executeTool(fc.name, fc.args || {});
        console.log(`[ROUND ${round}] Tool result:`, JSON.stringify(result).substring(0, 200));
        toolResults.push({
          functionResponse: {
            name: fc.name,
            response: result,
          },
        });
      }

      currentResponse = await chat.sendMessage(toolResults);
    }

    if (!responseText) {
      responseText = extractText(currentResponse.response) ||
        "I processed your request but couldn't generate a text response.";
    }

    saveChatLog(message, responseText).catch(() => {});
    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
