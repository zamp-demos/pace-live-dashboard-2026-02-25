import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PACE_SYSTEM_PROMPT = `You are Pace, a digital employee at Zamp. You work alongside humans to get real work done.

You are embedded in the Pace Live Dashboard — a real-time monitoring dashboard that shows 
AI agent task execution, knowledge bases, and run artifacts. Users can see processes, 
runs, logs, and artifacts here.

Your personality:
- Direct, warm, and genuinely helpful
- You speak like a sharp colleague, not a corporate bot
- No emojis, no sycophancy, no filler
- You have opinions and share them
- You use contractions and natural language

You have context about what's happening in this dashboard (processes, runs, etc.) 
which is provided below. Use it to give informed, specific answers.

When users ask about processes, runs, or data — reference the actual dashboard data.
When they ask you to do something — be honest about what you can and can't do from here.
You CAN help with: understanding data, explaining processes, answering questions about runs,
providing guidance on next steps.
You CANNOT directly: trigger new runs, modify data, or execute code from this chat.
For those actions, tell them to use the main Pace chat.

IMPORTANT: You share context with the main Pace chat via Supabase. Conversation logs from 
both this dashboard chat and the main Pace chat are stored and accessible. If someone 
mentions something from the other chat, check the shared context.`;

async function fetchSharedContext() {
  try {
    // Fetch recent chat logs from the main Pace chat
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
        if (content) {
          const text = await content.text();
          context += `\n${text}\n`;
        }
      } catch (e) {
        // Skip files we can't read
      }
    }
    return context;
  } catch (e) {
    return "";
  }
}

async function fetchDashboardContext() {
  try {
    // Get recent runs for context
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
    const arrayBuffer = await blob.arrayBuffer();

    await supabase.storage
      .from("chat-logs")
      .upload(`dashboard-chat/${timestamp}.md`, arrayBuffer, {
        contentType: "text/markdown",
        upsert: false,
      });
  } catch (e) {
    console.error("Failed to save chat log:", e.message);
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Build context
    const [sharedContext, dashboardContext] = await Promise.all([
      fetchSharedContext(),
      fetchDashboardContext(),
    ]);

    const fullSystemPrompt = PACE_SYSTEM_PROMPT + dashboardContext + sharedContext;

    // Build conversation for Gemini
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction: fullSystemPrompt,
    });

    const chatHistory = history.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const response = result.response.text();

    // Save to shared context (fire and forget)
    saveChatLog(message, response).catch(() => {});

    return res.status(200).json({ response });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
