import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';

const jobSchema = z.object({
  name: z.string(),
  facility: z.enum(['Indoor', 'Outdoor']),
  court: z.string().optional(),
  date: z.string(),
  startTime: z.string(),
  durationMinutes: z.number().positive(),
  players: z.number().int().positive(),
  notify: z.boolean().default(false),
});

const configSchema = z.object({
  jobs: z.array(jobSchema),
});

export type JobConfig = z.infer<typeof jobSchema>;
export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(filePath: string): AppConfig {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  const parsed = YAML.parse(raw);
  return configSchema.parse(parsed);
}
