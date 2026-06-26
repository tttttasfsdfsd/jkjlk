/**
 * EEXA Background Job Queue
 * Moves heavy work off the request thread: OCR, PDF, AI analysis, report generation
 * In-process queue (dev) — swap to BullMQ/SQS in production
 */
import { logger, metrics, startTimer } from "./observability";

// ==================== JOB TYPES ====================
export type JobType =
  | "ocr_process"
  | "pdf_extract"
  | "ai_analyze"
  | "report_generate"
  | "file_scan";

export interface Job<T = unknown> {
  id:        string;
  type:      JobType;
  payload:   T;
  userId:    number;
  companyId: number;
  priority:  "high" | "normal" | "low";
  attempts:  number;
  maxRetries:number;
  createdAt: number;
  status:    "pending" | "running" | "done" | "failed";
  result?:   unknown;
  error?:    string;
}

// ==================== QUEUE ====================
const queue: Job[]   = [];
const results = new Map<string, Job>();
let   isRunning = false;

export function enqueue<T>(
  type:      JobType,
  payload:   T,
  userId:    number,
  companyId: number,
  opts:      { priority?: Job["priority"]; maxRetries?: number } = {}
): string {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const job: Job<T> = {
    id, type, payload, userId, companyId,
    priority:   opts.priority   ?? "normal",
    maxRetries: opts.maxRetries ?? 3,
    attempts:   0,
    createdAt:  Date.now(),
    status:     "pending",
  };

  // Priority: high first
  if (opts.priority === "high") queue.unshift(job);
  else                           queue.push(job);

  metrics.inc("jobs_enqueued", { type });
  logger.info("job enqueued", { service:"queue", jobId:id, type, userId, companyId });

  if (!isRunning) processQueue();
  return id;
}

export function getJobResult(jobId: string): Job | null {
  return results.get(jobId) ?? queue.find(j => j.id === jobId) ?? null;
}

// ==================== WORKERS ====================
const WORKERS: Partial<Record<JobType, (job: Job) => Promise<unknown>>> = {
  async ocr_process(job) {
    // Production: call Tesseract / AWS Textract
    logger.info("OCR processing", { jobId: job.id, companyId: job.companyId });
    await new Promise(r => setTimeout(r, 100)); // simulate
    return { pages: 1, text: "PLACEHOLDER — connect Tesseract" };
  },

  async pdf_extract(job) {
    logger.info("PDF extracting", { jobId: job.id, companyId: job.companyId });
    await new Promise(r => setTimeout(r, 50));
    return { extracted: true };
  },

  async ai_analyze(job) {
    logger.info("AI analysis job", { jobId: job.id, companyId: job.companyId });
    // In production: call Anthropic API here
    return { status: "delegated_to_ai_router" };
  },

  async file_scan(job) {
    logger.info("File scan job", { jobId: job.id, companyId: job.companyId });
    // Production: call ClamAV / VirusTotal
    return { scanStatus: "clean" };
  },
};

async function processQueue(): Promise<void> {
  isRunning = true;
  while (queue.length > 0) {
    const job = queue.shift()!;
    job.status   = "running";
    job.attempts++;
    const t = startTimer();

    try {
      const worker = WORKERS[job.type];
      if (!worker) throw new Error(`No worker for job type: ${job.type}`);
      job.result = await worker(job);
      job.status = "done";
      metrics.inc("jobs_completed", { type: job.type });
      metrics.observe(`job_latency_ms_${job.type}`, t());
    } catch (err) {
      job.error = String(err).slice(0, 500);
      if (job.attempts < job.maxRetries) {
        job.status = "pending";
        queue.push(job); // re-queue
        metrics.inc("jobs_retried", { type: job.type });
      } else {
        job.status = "failed";
        metrics.inc("jobs_failed", { type: job.type });
        logger.error("job failed permanently", { jobId: job.id, type: job.type, error: job.error });
      }
    }

    results.set(job.id, job);
    if (results.size > 5000) {
      // Prune old results
      const oldest = [...results.keys()].slice(0, 1000);
      oldest.forEach(k => results.delete(k));
    }
  }
  isRunning = false;
}
