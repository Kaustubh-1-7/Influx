// app/api/github-score/route.js
import { NextResponse } from "next/server";
import { fetchGitHubData, calculateScore } from "./logic"; // Make sure path is correct

// ... (Your SCORE_OVERRIDES and createMockBreakdown functions remain the same) ...
const SCORE_OVERRIDES = {
    "rohandroid-7341": 10.0,
    "bansal-ishaan": 6.0,
};
function createMockBreakdown(targetScore) { /* ... same as before ... */ }


// --- THIS IS THE NEW PART ---
// Define the headers that will be added to every response.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Allows any origin to access this resource
  "Access-Control-Allow-Methods": "POST, OPTIONS", // Specifies the methods allowed
  "Access-Control-Allow-Headers": "Content-Type", // Specifies the headers allowed
};

// --- THIS IS ALSO NEW ---
// Handle the "preflight" request.
// Browsers send an OPTIONS request first to check if the actual POST is allowed.
export async function OPTIONS(request) {
  return new Response(null, {
    status: 204, // No Content
    headers: corsHeaders,
  });
}


// --- YOUR EXISTING POST FUNCTION WITH A SMALL MODIFICATION ---
export async function POST(request) {
    try {
        const { username } = await request.json();
        if (!username || typeof username !== 'string' || username.trim() === '') {
            return NextResponse.json({ error: "Username is required." }, { status: 400, headers: corsHeaders });
        }

        const normalizedUsername = username.trim().toLowerCase();

        const { user, repos, recentCommits, totalPRs, totalIssues, contributedToPRs } = await fetchGitHubData(username.trim());
        let scoreData = calculateScore(user, repos, recentCommits, totalPRs, totalIssues, contributedToPRs);

        if (SCORE_OVERRIDES.hasOwnProperty(normalizedUsername)) {
            const overrideScore = SCORE_OVERRIDES[normalizedUsername];
            scoreData.totalScore = overrideScore;
            scoreData.breakdown = createMockBreakdown(overrideScore);
            scoreData.isOverridden = true;
            scoreData.overrideNote = `Score manually set to ${overrideScore}. Original calculated data is still present in 'details'.`;
        }
        
        // Add the CORS headers to the successful response
        return NextResponse.json(scoreData, { headers: corsHeaders });

    } catch (error) {
        console.error("API Error in /api/github-score:", error.message);
        const status = error.message === "GitHub user not found." ? 404 :
                       error.message.startsWith("Rate limit exceeded") ? 429 : 500;
        
        // Add the CORS headers to the error response
        return NextResponse.json({ error: error.message }, { status, headers: corsHeaders });
    }
}