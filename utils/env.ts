import fs from "fs";
import path from "path";

const envFile = path.resolve(__dirname, "../.env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
