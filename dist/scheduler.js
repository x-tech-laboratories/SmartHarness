export const JOB_CLASSES = ['reactive', 'maintenance'];
// Run the first job that has work, reactive jobs before maintenance ones, and return its name, or null when none did.
export async function runNextJob(jobs, settings, options) {
    for (const jobClass of JOB_CLASSES) {
        for (const job of jobs) {
            if (job.jobClass === jobClass && (await job.step(settings, options))) {
                return job.name;
            }
        }
    }
    return null;
}
