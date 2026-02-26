import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://csvjcpmxndgaujxlvikw.supabase.co";
const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_PROCESS_ID = "edbee70e-72bd-4573-ae80-cd3888f6a75f";

// ─── Tool definitions for Claude ───
const tools = [
  {
    name: "read_knowledge_base",
    description: "Read the current Knowledge Base for a process. Returns the full KB markdown content.",
    input_schema: {
      type: "object",
      properties: {
        process_id: { type: "string", description: "The process ID. Defaults to current process context." }
      }
    }
  },
  {
    name: "update_knowledge_base",
    description: "Replace the entire Knowledge Base with new content. Use when user wants to overwrite or completely rewrite the KB.",
    input_schema: {
      type: "object",
      properties: {
        process_id: { type: "string", description: "The process ID." },
        content: { type: "string", description: "The full new markdown content for the KB." }
      },
      required: ["content"]
    }
  },
  {
    name: "append_to_knowledge_base",
    description: "Append new content to the end of the Knowledge Base, optionally under a new section heading.",
    input_schema: {
      type: "object",
      properties: {
        process_id: { type: "string", description: "The process ID." },
        content: { type: "string", description: "The markdown content to append." },
        section: { type: "string", description: "Optional section heading to add before the content." }
      },
      required: ["content"]
    }
  },
  {
    name: "list_skills",
    description: "List all available skills that Pace can execute. Returns skill names, descriptions, and example prompts.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter: analytics, engineering, customer-success, sales, meetings, customer-ops, internal, search, utility" }
      }
    }
  },
  {
    name: "get_skill_details",
    description: "Get full details for a specific skill including description, triggers, and example prompts.",
    input_schema: {
      type: "object",
      properties: {
        skill_name: { type: "string", description: "The skill name (e.g. 'reporting', 'data-query', 'weekly-changelog-pdf')" }
      },
      required: ["skill_name"]
    }
  },
  {
    name: "update_skill",
    description: "Update a skill's definition - change its description, triggers, example prompts, or enabled status. Changes are applied immediately to the skills database.",
    input_schema: {
      type: "object",
      properties: {
        skill_name: { type: "string", description: "The skill name to update." },
        updates: {
          type: "object",
          description: "Fields to update. Can include: title, description, category, triggers (array), example_prompts (array), enabled (boolean).",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            triggers: { type: "array", items: { type: "string" } },
            example_prompts: { type: "array", items: { type: "string" } },
            enabled: { type: "boolean" }
          }
        }
      },
      required: ["skill_name", "updates"]
    }
  },
  {
    name: "log_change",
    description: "Log an action or change to the audit trail. Use this whenever you make a modification so we have a record.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", description: "What was done (e.g. 'updated_kb', 'modified_skill', 'queued_feature_request')" },
        entity_type: { type: "string", description: "What was changed: 'knowledge_base', 'skill', 'workflow', 'ui', 'feature_request'" },
        entity_name: { type: "string", description: "Name of the entity (e.g. 'Invoice Processing KB', 'reporting skill')" },
        details: { type: "string", description: "Human-readable description of the change." }
      },
      required: ["action", "entity_type", "details"]
    }
  },
  {
    name: "queue_pending_change",
    description: "Queue a change that requires the main Pace chat to apply (code deployments, GitHub changes, external API calls, new features). These get reviewed and applied from the main chat.",
    input_schema: {
      type: "object",
      properties: {
        change_type: { type: "string", description: "Type: 'code_change', 'deployment', 'feature_request', 'integration', 'external_api'" },
        description: { type: "string", description: "Clear description of what needs to be done." },
        details: { type: "string", description: "Technical details, specifications, or context needed to implement." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level." }
      },
      required: ["change_type", "description"]
    }
  },
  {
    name: "get_change_log",
    description: "Retrieve recent changes from the audit log. Shows what actions the dashboard chat has taken.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent entries to return. Default 10." }
      }
    }
  },
  {
    name: "get_pending_changes",
    description: "List pending changes that are queued for the main Pace chat to review and apply.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "approved", "applied", "rejected"], description: "Filter by status. Default: all." }
      }
    }
  }
];

// ─── Tool execution ───
async function executeTool(name, args, processId) {
  const pid = args.process_id || processId || DEFAULT_PROCESS_ID;

  console.log(`[TOOL] ${name}`, JSON.stringify(args).substring(0, 200));

  try {
    if (name === "read_knowledge_base") {
      const { data, error } = await supabase.storage.from("knowledge-base").download(`${pid}/kb.md`);
      if (error) return { error: `KB not found: ${error.message}` };
      return { content: await data.text(), process_id: pid };
    }

    if (name === "update_knowledge_base") {
      const buf = new TextEncoder().encode(args.content);
      const { error } = await supabase.storage.from("knowledge-base")
        .upload(`${pid}/kb.md`, buf, { contentType: "text/markdown", upsert: true, cacheControl: "no-cache" });
      if (error) return { error: error.message };
      // Auto-log the change
      await logChangeInternal("updated_kb", "knowledge_base", `Process ${pid} KB`, "Knowledge base content was replaced.");
      return { success: true, action: "replaced", process_id: pid };
    }

    if (name === "append_to_knowledge_base") {
      let existing = "";
      const { data } = await supabase.storage.from("knowledge-base").download(`${pid}/kb.md`);
      if (data) existing = await data.text();
      const sep = args.section ? `\n\n## ${args.section}\n\n` : "\n\n";
      const updated = existing + sep + args.content;
      const buf = new TextEncoder().encode(updated);
      const { error } = await supabase.storage.from("knowledge-base")
        .upload(`${pid}/kb.md`, buf, { contentType: "text/markdown", upsert: true, cacheControl: "no-cache" });
      if (error) return { error: error.message };
      await logChangeInternal("appended_kb", "knowledge_base", `Process ${pid} KB`, `Appended content${args.section ? ' under section: ' + args.section : ''}.`);
      return { success: true, action: "appended", process_id: pid };
    }

    if (name === "list_skills") {
      const { data, error } = await supabase.storage.from("skills").download("index.json");
      if (error) return { error: error.message };
      let skills = JSON.parse(await data.text());
      if (args.category) skills = skills.filter(s => s.category === args.category);
      return { skills: skills.map(s => ({ name: s.name, title: s.title, description: s.description, category: s.category, enabled: s.enabled !== false })), count: skills.length };
    }

    if (name === "get_skill_details") {
      const { data, error } = await supabase.storage.from("skills").download(`${args.skill_name}.json`);
      if (error) return { error: `Skill not found: ${args.skill_name}` };
      return JSON.parse(await data.text());
    }

    if (name === "update_skill") {
      // Read current skill
      const { data: skillData, error: readErr } = await supabase.storage.from("skills").download(`${args.skill_name}.json`);
      if (readErr) return { error: `Skill not found: ${args.skill_name}` };
      const skill = JSON.parse(await skillData.text());

      // Apply updates
      const updated = { ...skill, ...args.updates };
      const buf = new TextEncoder().encode(JSON.stringify(updated, null, 2));
      const { error: writeErr } = await supabase.storage.from("skills")
        .upload(`${args.skill_name}.json`, buf, { contentType: "application/json", upsert: true, cacheControl: "no-cache" });
      if (writeErr) return { error: writeErr.message };

      // Update the index too
      const { data: indexData } = await supabase.storage.from("skills").download("index.json");
      if (indexData) {
        let index = JSON.parse(await indexData.text());
        index = index.map(s => s.name === args.skill_name ? updated : s);
        const idxBuf = new TextEncoder().encode(JSON.stringify(index, null, 2));
        await supabase.storage.from("skills")
          .upload("index.json", idxBuf, { contentType: "application/json", upsert: true, cacheControl: "no-cache" });
      }

      await logChangeInternal("updated_skill", "skill", args.skill_name, `Updated fields: ${Object.keys(args.updates).join(", ")}`);
      return { success: true, skill_name: args.skill_name, updated_fields: Object.keys(args.updates) };
    }

    if (name === "log_change") {
      return await logChangeInternal(args.action, args.entity_type, args.entity_name || "", args.details);
    }

    if (name === "queue_pending_change") {
      const entry = {
        id: crypto.randomUUID(),
        change_type: args.change_type,
        description: args.description,
        details: args.details || "",
        priority: args.priority || "medium",
        status: "pending",
        requested_by: "dashboard-chat",
        created_at: new Date().toISOString()
      };
      const buf = new TextEncoder().encode(JSON.stringify(entry, null, 2));
      const { error } = await supabase.storage.from("pending-changes")
        .upload(`${entry.id}.json`, buf, { contentType: "application/json", upsert: false });
      if (error) return { error: error.message };
      await logChangeInternal("queued_change", "pending_change", args.change_type, args.description);
      return { success: true, id: entry.id, status: "pending" };
    }

    if (name === "get_change_log") {
      const limit = args.limit || 10;
      const { data: files, error } = await supabase.storage.from("change-log")
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error || !files) return { entries: [], error: error?.message };
      const entries = [];
      for (const file of files.slice(0, limit)) {
        try {
          const { data } = await supabase.storage.from("change-log").download(file.name);
          if (data) entries.push(JSON.parse(await data.text()));
        } catch (e) {}
      }
      return { entries, count: entries.length };
    }

    if (name === "get_pending_changes") {
      const { data: files, error } = await supabase.storage.from("pending-changes")
        .list("", { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      if (error || !files) return { changes: [], error: error?.message };
      const changes = [];
      for (const file of files) {
        try {
          const { data } = await supabase.storage.from("pending-changes").download(file.name);
          if (data) {
            const change = JSON.parse(await data.text());
            if (!args.status || change.status === args.status) changes.push(change);
          }
        } catch (e) {}
      }
      return { changes, count: changes.length };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (e) {
    console.error(`[TOOL ERROR] ${name}:`, e.message);
    return { error: e.message };
  }
}

// ─── Internal change logging ───
async function logChangeInternal(action, entityType, entityName, details) {
  const entry = {
    id: crypto.randomUUID(),
    action,
    entity_type: entityType,
    entity_name: entityName,
    details,
    performed_by: "dashboard-chat",
    created_at: new Date().toISOString()
  };
  const buf = new TextEncoder().encode(JSON.stringify(entry, null, 2));
  const { error } = await supabase.storage.from("change-log")
    .upload(`${entry.created_at.replace(/[:.]/g, "-")}_${entry.id.slice(0, 8)}.json`, buf, {
      contentType: "application/json", upsert: false
    });
  return error ? { error: error.message } : { success: true, id: entry.id };
}

// ─── System prompt ───
function buildSystemPrompt(orgId, orgName, processId, processName, skillsSummary) {
  let orgContext = "";
  if (orgName) {
    orgContext = `\nCURRENT CONTEXT:\n- Organization: ${orgName} (ID: ${orgId})\n- Process: ${processName || "none selected"} (ID: ${processId || "none"})\n\nThe user is viewing this org and process on the Pace Live Dashboard.`;
  }

  return `You are Pace, a digital employee at Zamp. You are embedded in the Pace Live Dashboard as an interactive assistant.

Your personality: Direct, warm, genuinely helpful. No emojis, no filler. You speak like a sharp colleague.
${orgContext}

WHAT YOU CAN DO:

1. KNOWLEDGE BASE MANAGEMENT
   - Read, update, or append to the Knowledge Base for any process
   - Always use the tools — don't just describe what you would do

2. SKILLS MANAGEMENT
   - List all available skills (the same skills the main Pace chat uses)
   - View skill details (description, triggers, examples)
   - Update skill definitions (description, triggers, examples, enabled status)
   - Skills you update here are immediately available

3. DASHBOARD ACTIONS (applied immediately via Supabase)
   - KB changes, skill updates, workflow config changes
   - These take effect right away since the dashboard reads from Supabase

4. QUEUED CHANGES (for the main Pace chat to apply)
   - Code changes, deployments, new features, external API integrations
   - Queue these as pending changes — they'll be reviewed and applied from the main Pace chat

5. AUDIT TRAIL
   - Every change you make is logged automatically
   - You can view the change log and pending changes queue

6. CONTEXT & INTELLIGENCE
   - Answer questions about processes, runs, organizations on the dashboard
   - You share context with the main Pace chat via Supabase

AVAILABLE SKILLS:
${skillsSummary}

IMPORTANT RULES:
- When the user asks to modify something, USE THE TOOLS. Don't just describe what you would do.
- Log every significant action for auditability.
- If a requested change requires code deployment or external access, queue it as a pending change.
- Be honest about what you can and can't do from the dashboard.
- Default process is ${processName || "Invoice Processing"} (ID: ${processId || DEFAULT_PROCESS_ID}).`;
}

// ─── Context fetchers ───
async function fetchSkillsSummary() {
  try {
    const { data, error } = await supabase.storage.from("skills").download("index.json");
    if (error || !data) return "No skills loaded.";
    const skills = JSON.parse(await data.text());
    return skills
      .filter(s => s.enabled !== false)
      .map(s => `- **${s.title}** (${s.name}): ${s.description}`)
      .join("\n");
  } catch (e) { return "Error loading skills."; }
}

async function fetchDashboardContext(processId) {
  try {
    let query = supabase.from("activity_runs")
      .select("id, name, document_name, status, current_status_text, created_at")
      .order("updated_at", { ascending: false })
      .limit(10);
    if (processId) query = query.eq("process_id", processId);
    const { data: runs } = await query;
    if (!runs || runs.length === 0) return "";
    let ctx = "\n\n--- Current Dashboard State ---\nRecent runs:\n";
    for (const run of runs) {
      ctx += `- ${run.name} | Status: ${run.status} | ${run.current_status_text || ""} | ${run.created_at}\n`;
    }
    return ctx;
  } catch (e) { return ""; }
}

async function fetchOrgContext() {
  try {
    const { data: orgs } = await supabase.from("organizations")
      .select("id, name, avatar_letter")
      .order("created_at", { ascending: true });
    if (!orgs || orgs.length === 0) return "";
    let ctx = "\n\n--- Available Organizations ---\n";
    for (const org of orgs) {
      ctx += `\n### ${org.name} (ID: ${org.id})\n`;
      const { data: procs } = await supabase.from("processes")
        .select("id, name").eq("org_id", org.id).order("created_at", { ascending: true });
      if (procs && procs.length > 0) {
        ctx += "Processes:\n";
        for (const proc of procs) {
          const { count } = await supabase.from("activity_runs")
            .select("id", { count: "exact", head: true }).eq("process_id", proc.id);
          ctx += `- ${proc.name} (ID: ${proc.id}) — ${count || 0} runs\n`;
        }
      }
    }
    return ctx;
  } catch (e) { return ""; }
}

async function saveChatLog(userMessage, assistantResponse) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const log = `## Dashboard Chat — ${ts}\n**User:** ${userMessage}\n**Pace:** ${assistantResponse}\n`;
    const buf = new TextEncoder().encode(log);
    await supabase.storage.from("chat-logs")
      .upload(`dashboard-chat/${ts}.md`, buf, { contentType: "text/markdown", upsert: false, cacheControl: "no-cache" });
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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { message, history = [], orgId, orgName, processId, processName } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Fetch context in parallel
    const [skillsSummary, dashboardContext, orgContext] = await Promise.all([
      fetchSkillsSummary(),
      fetchDashboardContext(processId),
      fetchOrgContext(),
    ]);

    const systemPrompt = buildSystemPrompt(orgId, orgName, processId, processName, skillsSummary)
      + orgContext + dashboardContext;

    // Build Claude message history
    const claudeHistory = history.map(msg => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    // Add current message
    const messages = [...claudeHistory, { role: "user", content: message }];

    // Tool use loop (up to 10 rounds)
    let currentMessages = messages;
    let finalText = "";

    for (let round = 0; round < 10; round++) {
      console.log(`[ROUND ${round}] Sending to Claude...`);

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      });

      console.log(`[ROUND ${round}] Stop reason: ${response.stop_reason}`);

      // Check if we're done (no tool use)
      if (response.stop_reason === "end_turn" || response.stop_reason !== "tool_use") {
        // Extract text from response
        finalText = response.content
          .filter(block => block.type === "text")
          .map(block => block.text)
          .join("");
        break;
      }

      // Handle tool use
      const toolUseBlocks = response.content.filter(block => block.type === "tool_use");
      const toolResults = [];

      for (const toolBlock of toolUseBlocks) {
        console.log(`[ROUND ${round}] Tool: ${toolBlock.name}`);
        const result = await executeTool(toolBlock.name, toolBlock.input, processId);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        });
      }

      // Add assistant response and tool results to messages
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }

    if (!finalText) {
      finalText = "I processed your request but couldn't generate a text response.";
    }

    saveChatLog(message, finalText).catch(() => {});
    return res.status(200).json({ response: finalText });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
