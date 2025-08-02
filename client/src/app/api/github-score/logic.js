// app/api/github-score/scoreLogic.js

// Paste your GITHUB_TOKEN definition, fetchWithRetry, fetchGitHubData, and calculateScore functions here.
// Make sure to export fetchGitHubData and calculateScore.

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    // ... your fetchWithRetry implementation ...
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
                const resetTime = parseInt(response.headers.get('X-RateLimit-Reset')) * 1000;
                const waitTime = Math.max(0, resetTime - Date.now() + 1000);
                console.warn(`Rate limit hit. Waiting for ${waitTime / 1000}s...`);
                if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, waitTime));
                else throw new Error(`Rate limit exceeded after ${retries} retries for ${url}`);
            } else if (!response.ok) {
                 if (i < retries - 1) {
                    console.warn(`Request to ${url} failed with status ${response.status}. Retrying...`);
                    await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
                 } else {
                    throw new Error(`Failed to fetch from ${url} after ${retries} retries: ${response.status} ${response.statusText}`);
                 }
            }
        } catch (error) {
            if (i < retries - 1) {
                console.warn(`Request to ${url} encountered an error. Retrying... Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            } else {
                throw error; // Rethrow the original error if all retries fail
            }
        }
    }
    // This line should ideally not be reached if the loop handles all cases properly or throws
    throw new Error(`Failed to fetch from ${url} after ${retries} retries (loop completed unexpectedly).`);
}


export async function fetchGitHubData(username) {
    // ... your fetchGitHubData implementation ...
    if (!GITHUB_TOKEN) {
        throw new Error("GitHub API token is not configured on the server.");
    }
    const headers = {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
    };

    const userResponse = await fetchWithRetry(`https://api.github.com/users/${username}`, { headers });
    // Removed the 404 check here as fetchWithRetry should throw an error if all retries fail
    // if (!userResponse.ok && userResponse.status === 404) throw new Error("GitHub user not found.");
    // if (!userResponse.ok) throw new Error(`Failed to fetch user data: ${userResponse.statusText}`); // This will be caught by fetchWithRetry
    const user = await userResponse.json();

    const reposResponse = await fetchWithRetry(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated&type=owner`, { headers });
    const repos = reposResponse.ok ? await reposResponse.json() : []; // Keep this fallback for repos

    let recentCommitsCount = 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const reposToScanForCommits = repos.slice(0, 5); // Scan top 5 most recently updated repos
    for (const repo of reposToScanForCommits) {
        if (!repo.commits_url) continue; // Skip if commits_url is not present
        try {
            const commitsUrl = repo.commits_url.replace('{/sha}', '');
            // Added per_page to commits to ensure we get up to 100 if available
            const commitsResponse = await fetchWithRetry(`${commitsUrl}?author=${username}&since=${thirtyDaysAgo}&per_page=100`, { headers });
            if (commitsResponse.ok) { // Should always be ok if fetchWithRetry succeeds
                const commits = await commitsResponse.json();
                recentCommitsCount += commits.length;
            }
        } catch (commitError) {
            console.warn(`Could not fetch commits for ${repo.name}:`, commitError.message);
        }
    }

    // For search queries, total_count is usually reliable
    const prsResponse = await fetchWithRetry(`https://api.github.com/search/issues?q=author:${username}+type:pr&per_page=1`, { headers });
    const prsData = await prsResponse.json();
    const totalPRs = prsData.total_count || 0;

    const issuesResponse = await fetchWithRetry(`https://api.github.com/search/issues?q=author:${username}+type:issue&per_page=1`, { headers });
    const issuesData = await issuesResponse.json();
    const totalIssues = issuesData.total_count || 0;
    
    // ContributedToPRs means PRs authored by the user in repos NOT owned by the user.
    // The query `author:${username}+type:pr+-user:${username}` correctly searches for this.
    const contribResponse = await fetchWithRetry(`https://api.github.com/search/issues?q=author:${username}+type:pr+-user:${username}&per_page=1`, { headers });
    const contribData = await contribResponse.json();
    const contributedToPRs = contribData.total_count || 0;


    return { user, repos, recentCommits: recentCommitsCount, totalPRs, totalIssues, contributedToPRs };
}

export function calculateScore(user, repos, recentCommits, totalPRs, totalIssues, contributedToPRs) {
    // ... your calculateScore implementation ...
    const totalStars = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
    const totalForks = repos.reduce((sum, repo) => sum + (repo.forks_count || 0), 0);
    const accountAge = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365);
    const languages = new Set(repos.map((repo) => repo.language).filter(Boolean));
    const languageCount = languages.size;

    let profileFields = 0;
    if (user.name) profileFields++;
    if (user.bio) profileFields++;
    if (user.location) profileFields++;
    if (user.company) profileFields++;
    if (user.blog) profileFields++;
    const profileCompleteness = (profileFields / 5) * 100;

    const scores = {
        repositories: Math.min(10, 5 + (user.public_repos / 25) * 5),
        followers: Math.min(10, 5 + Math.log10(Math.max(1, user.followers + 1)) * 1.5), // +1 to avoid log(0) or log(1) being 0
        stars: Math.min(10, 5 + Math.log10(Math.max(1, totalStars + 1)) * 1.2),
        forks: Math.min(10, 5 + Math.log10(Math.max(1, totalForks + 1)) * 1.0),
        accountAge: Math.min(10, 5 + Math.min(5, accountAge * 1.25)), // Capped contribution from age
        activity: Math.min(10, 5 + (recentCommits / 25) * 5), // 25 commits in 30 days for max activity points in this category
        prs: Math.min(10, 5 + Math.log10(Math.max(1, totalPRs + 1)) * 1.5),
        issues: Math.min(10, 5 + Math.log10(Math.max(1, totalIssues + 1)) * 1.0),
        contributions: Math.min(10, 5 + Math.log10(Math.max(1, contributedToPRs + 1)) * 2.0), // Higher weight for external contributions
        profile: 5 + (profileCompleteness / 100) * 5,
        languages: Math.min(10, 5 + (languageCount / 4) * 5), // 4 diverse languages for max points
    };
    
    // Ensure each score is between 5 and 10 and has one decimal place
    for (const key in scores) {
        scores[key] = parseFloat(Math.max(5, Math.min(10, scores[key])).toFixed(1));
    }

    const weights = {
        repositories: 0.10, followers: 0.10, stars: 0.15, forks: 0.05,
        accountAge: 0.10, activity: 0.15, prs: 0.10, issues: 0.05,
        contributions: 0.10, profile: 0.05, languages: 0.05,
    };

    let weightedScore = 0;
    for (const key in scores) {
        weightedScore += scores[key] * (weights[key] || 0); // Ensure weight exists
    }
    // The final score should also be clamped between 5 and 10
    const finalScore = Math.max(5, Math.min(10, weightedScore)) + 0.1;

    return {
        username: user.login,
        totalScore: parseFloat(finalScore.toFixed(1)),
        breakdown: scores, // Breakdown already formatted
        details: {
            publicRepos: user.public_repos,
            followers: user.followers,
            totalStars,
            totalForks,
            accountAgeYears: parseFloat(accountAge.toFixed(1)),
            recentCommits,
            totalPRs,
            totalIssues,
            contributedToPRs,
            profileCompleteness: Math.round(profileCompleteness),
            languageCount,
            avatarUrl: user.avatar_url, // Add avatar
            githubUrl: user.html_url, // Add profile URL
            name: user.name || user.login, // Use login if name is null
            bio: user.bio, // Add bio
        },
    };
}