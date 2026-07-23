import { Job } from '../types';

/**
 * Generates the next unique Component Job ID in the format C00001, C00002, etc.
 * Scans all existing jobs to find the highest numerical suffix for IDs matching CXXXXX.
 */
export function generateNextComponentId(existingJobs: Job[], offset: number = 0): string {
  let maxNum = 0;
  if (existingJobs && Array.isArray(existingJobs)) {
    for (const job of existingJobs) {
      if (job.id) {
        const match = job.id.match(/^C(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
  }
  const nextNum = maxNum + 1 + offset;
  return `C${nextNum.toString().padStart(5, '0')}`;
}

/**
 * Generates the next unique Job Card Number in the format J00001, J00002, etc.
 * Scans all existing jobs to find the highest numerical suffix for jobCardNumber matching JXXXXX.
 */
export function generateNextJobCardNumber(existingJobs: Job[], offset: number = 0): string {
  let maxNum = 0;
  if (existingJobs && Array.isArray(existingJobs)) {
    for (const job of existingJobs) {
      const jNum = job.jobCardDetails?.jobCardNumber;
      if (jNum) {
        const match = jNum.match(/^J(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
  }
  const nextNum = maxNum + 1 + offset;
  return `J${nextNum.toString().padStart(5, '0')}`;
}
