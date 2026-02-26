export default function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY || 'NOT_SET';
  res.json({
    keyLength: key.length,
    keyPrefix: key.substring(0, 14),
    keySuffix: key.substring(key.length - 10),
    keySet: key !== 'NOT_SET'
  });
}
