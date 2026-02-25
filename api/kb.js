import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://csvjcpmxndgaujxlvikw.supabase.co";
const supabase = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const processId = req.query.processId || "edbee70e-72bd-4573-ae80-cd3888f6a75f";
  const kbPath = `${processId}/kb.md`;

  try {
    // GET — read current KB
    if (req.method === "GET") {
      const { data, error } = await supabase.storage
        .from("knowledge-base")
        .download(kbPath);

      if (error) {
        return res.status(404).json({ error: "KB not found", detail: error.message });
      }

      const text = await data.text();
      return res.status(200).json({ processId, content: text });
    }

    // PUT — replace entire KB
    if (req.method === "PUT") {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: "content is required" });

      const blob = new Blob([content], { type: "text/markdown" });
      const buffer = await blob.arrayBuffer();

      const { error } = await supabase.storage
        .from("knowledge-base")
        .upload(kbPath, buffer, {
          contentType: "text/markdown",
          upsert: true,
          cacheControl: "no-cache",
        });

      if (error) throw error;
      return res.status(200).json({ success: true, action: "replaced", processId });
    }

    // POST — append to KB
    if (req.method === "POST") {
      const { content, section } = req.body;
      if (!content) return res.status(400).json({ error: "content is required" });

      // Download existing KB
      let existing = "";
      const { data } = await supabase.storage
        .from("knowledge-base")
        .download(kbPath);

      if (data) {
        existing = await data.text();
      }

      // Append new content
      const separator = section ? `\n\n## ${section}\n\n` : "\n\n";
      const updated = existing + separator + content;

      const blob = new Blob([updated], { type: "text/markdown" });
      const buffer = await blob.arrayBuffer();

      const { error } = await supabase.storage
        .from("knowledge-base")
        .upload(kbPath, buffer, {
          contentType: "text/markdown",
          upsert: true,
          cacheControl: "no-cache",
        });

      if (error) throw error;
      return res.status(200).json({ success: true, action: "appended", processId });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("KB error:", error);
    return res.status(500).json({ error: error.message });
  }
}
