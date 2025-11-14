export interface ScheduledJob {
  name: string;
  runAt: Date;
}

export class Scheduler {
  constructor(private readonly jobs: ScheduledJob[]) {}

  start() {
    // TODO: hook into node-cron and manage 48h offsets
    for (const job of this.jobs) {
      console.log(`Would schedule ${job.name} at ${job.runAt.toISOString()}`);
    }
  }
}
