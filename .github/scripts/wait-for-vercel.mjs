// Waits for the Vercel deployment of a commit and fails unless it finishes successfully.
const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_OUTPUT } = process.env;

const TIMEOUT_MS = 15 * 60 * 1000;
const POLL_MS = 15 * 1000;
const FAILED_STATES = ["error", "failure"];

const api = async (path) => {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/${path}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
  });

  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${path}`);
  return response.json();
};

// the newest state of the newest deployment of this commit, if Vercel created one yet
const getLatestStatus = async () => {
  const [deployment] = await api(`deployments?sha=${GITHUB_SHA}&per_page=1`);
  if (!deployment) return null;

  const [status] = await api(`deployments/${deployment.id}/statuses?per_page=1`);
  return status ?? null;
};

const waitForDeployment = async () => {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await getLatestStatus();
    console.log(`Vercel: ${status?.state ?? "no deployment yet"}`);

    if (status?.state === "success") return status;
    if (FAILED_STATES.includes(status?.state)) {
      throw new Error(`The deployment failed: ${status.log_url || status.target_url}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  throw new Error("Vercel did not finish the deployment in time");
};

const { environment_url: url } = await waitForDeployment();
console.log(`Deployed to ${url}`);

if (GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(GITHUB_OUTPUT, `url=${url}\n`);
}
