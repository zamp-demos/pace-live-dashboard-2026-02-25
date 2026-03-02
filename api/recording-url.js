import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const URL_EXPIRY_SECONDS = 900; // 15 minutes

function getS3Client() {
  const accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY;
  const region = process.env.AWS_S3_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials not configured");
  }

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = req.query.key;
  if (!key) return res.status(400).json({ error: "Missing 'key' query parameter" });
  if (!key.endsWith(".mp4")) return res.status(400).json({ error: "Invalid key format" });

  const bucket = process.env.AWS_S3_BUCKET || "zamp-prd-us-selenium-grid-bucket";

  try {
    const s3 = getS3Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn: URL_EXPIRY_SECONDS });
    return res.status(200).json({ url, expires_in: URL_EXPIRY_SECONDS });
  } catch (err) {
    console.error("Failed to generate pre-signed URL:", err.message);
    return res.status(500).json({ error: "Failed to generate video URL", detail: err.message });
  }
}
