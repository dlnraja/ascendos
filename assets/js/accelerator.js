/**
 * Career Accelerator — thin facade over CareerVectors.
 * ESN→client final is one vector; scoring uses the user's active upgrade vectors.
 */
const CareerAccelerator = (() => {
  function scoreJob(job, profile = {}) {
    return CareerVectors.scoreJob(job, profile);
  }

  function rankJobs(jobs, profile) {
    return CareerVectors.rankJobs(jobs, profile);
  }

  return {
    scoreJob,
    rankJobs,
    get VECTORS() {
      return CareerVectors.VECTORS;
    },
    get CATEGORIES() {
      return CareerVectors.CATEGORIES;
    },
  };
})();

window.CareerAccelerator = CareerAccelerator;
