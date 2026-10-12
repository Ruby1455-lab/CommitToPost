"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { auth, githubProvider } from "./lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

type CardTheme = "vscode" | "cyberpunk" | "dracula" | "minimal";

const THEME_STYLES: Record<CardTheme, { bg: string; border: string; badge: string; text: string }> = {
  vscode: {
    bg: "bg-slate-900",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    text: "text-slate-100",
  },
  cyberpunk: {
    bg: "bg-gradient-to-br from-yellow-950 via-purple-950 to-pink-950",
    border: "border-pink-500/50 shadow-pink-500/20",
    badge: "bg-yellow-400 text-black font-extrabold border-yellow-300",
    text: "text-yellow-100",
  },
  dracula: {
    bg: "bg-[#282a36]",
    border: "border-[#bd93f9]/40",
    badge: "bg-[#ff79c6]/20 text-[#ff79c6] border-[#ff79c6]/40",
    text: "text-[#f8f8f2]",
  },
  minimal: {
    bg: "bg-white text-slate-900",
    border: "border-slate-200 shadow-xl",
    badge: "bg-slate-100 text-slate-800 border-slate-300",
    text: "text-slate-900 font-sans",
  },
};

export default function Home() {
  // User Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(10); // Free starting credits

  // Form State
  const [repoName, setRepoName] = useState("");
  const [commits, setCommits] = useState("");
  const [persona, setPersona] = useState("influencer");
  const [generatedPost, setGeneratedPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Telemetry & Hustle Score State
  const [hustleScore, setHustleScore] = useState<number | null>(null);
  const [badge, setBadge] = useState<string>("");
  const [impactSummary, setImpactSummary] = useState<string>("");

  // Custom Theme & Branding State
  const [cardTheme, setCardTheme] = useState<CardTheme>("vscode");
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  // Team & Native Sponsorship State
  const [activeWorkspace, setActiveWorkspace] = useState("Personal Dev");
  const [sponsorName, setSponsorName] = useState("Vercel");

  // Auto-Scheduler State
  const [connectedX, setConnectedX] = useState(false);
  const [connectedLinkedIn, setConnectedLinkedIn] = useState(false);
  const [scheduleMode, setScheduleMode] = useState("immediate");
  const [scheduledQueue, setScheduledQueue] = useState<Array<{ id: string; text: string; time: string; platform: string }>>([]);
  const [schedulingSuccess, setSchedulingSuccess] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLoginWithGitHub = async () => {
    try {
      await signInWithPopup(auth, githubProvider);
    } catch (error) {
      console.error("GitHub sign-in error:", error);
      // Local fallback for quick UI preview
      setUser({
        displayName: "GitHub Developer",
        email: "dev@github.com",
        photoURL: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
      } as User);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setUser(null);
    }
  };

  const handleUpgradeToPro = async () => {
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planType: "pro",
          userEmail: user?.email,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Payment redirect failed:", err);
      alert("Could not initiate Stripe checkout session.");
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      alert("Please sign in with GitHub to generate posts and track your credits!");
      return;
    }

    if (credits <= 0) {
      alert("You have run out of free credits! Upgrade to Pro for unlimited generation.");
      return;
    }

    if (!commits) {
      alert("Please enter some commits!");
      return;
    }

    setLoading(true);
    setGeneratedPost("");
    setHustleScore(null);
    setSchedulingSuccess(false);

    try {
      const commitList = commits
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((msg) => ({ commit: { message: msg } }));

      const response = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoName: repoName || "my-awesome-project",
          commits: commitList,
          persona: persona,
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert("Error: " + data.error);
      } else {
        setGeneratedPost(data.post);
        setHustleScore(data.hustleScore);
        setBadge(data.badge);
        setImpactSummary(data.impactSummary);
        setCredits((prev) => Math.max(0, prev - 1)); // Deduct 1 credit per generation
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong generating the post.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true });
      const link = document.createElement("a");
      link.download = `${repoName || "commit-to-post"}-telemetry-card.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to capture image:", err);
      alert("Failed to export card image.");
    } finally {
      setDownloading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAddToQueue = () => {
    if (!generatedPost) return;

    const newItem = {
      id: Date.now().toString(),
      text: generatedPost,
      time: scheduleMode === "immediate" ? "Publishing Now 🚀" : "Queued for Next Peak Window",
      platform: `${connectedX ? "𝕏 " : ""}${connectedLinkedIn ? "in" : "𝕏"}`,
    };

    setScheduledQueue([newItem, ...scheduledQueue]);
    setSchedulingSuccess(true);
    setTimeout(() => setSchedulingSuccess(false), 4000);
  };

  const activeStyle = THEME_STYLES[cardTheme];

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 md:p-10 max-w-5xl mx-auto font-sans">
      {/* Header & Auth Bar */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-5 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
            CommitToPost 🚀
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            AI developer advocacy, dev telemetry metrics, and automated social publishing.
          </p>
        </div>

        {/* User Profile / GitHub Auth Button */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl shadow-md">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full border border-blue-500" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                    {user.displayName?.[0] || "D"}
                  </div>
                )}
                <div className="text-xs">
                  <p className="font-semibold text-slate-200">{user.displayName || "Developer"}</p>
                  <p className="text-amber-400 font-mono text-[10px]">⚡ {credits} Credits Left</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={handleLoginWithGitHub}
              className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg transition-all shadow flex items-center gap-2"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Sign in with GitHub</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-2 space-y-6 bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Repository Name
            </label>
            <input
              type="text"
              placeholder="e.g. commit-to-post"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Choose Persona / Tone ✨
            </label>
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="influencer">🚀 Tech Influencer (High Engagement)</option>
              <option value="junior">☕ Caffeinated Junior (3 AM Panic & Energy)</option>
              <option value="senior">🧘 Battle-Tested Senior Architect (Pragmatic)</option>
              <option value="meme">🎭 Tech Meme & Code Humor Mode</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-300">
              Paste Recent Commits (One per line)
            </label>
            <textarea
              rows={5}
              placeholder="fix: resolved race condition in auth token refresh&#10;feat: implemented dark mode theme switcher&#10;refactor: optimized bundle size by 34%"
              value={commits}
              onChange={(e) => setCommits(e.target.value)}
              className="w-full bg-slate-950 text-white p-3 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? "Analyzing Commits & Calculating Telemetry..." : user ? "🔥 Generate Post & Dev Telemetry" : "🔑 Sign In with GitHub to Generate"}
          </button>
        </div>

        {/* Right Column: Monetization, Workspaces & Card Studio */}
        <div className="space-y-6">
          {/* Pro Billing Banner */}
          <div className="bg-gradient-to-br from-indigo-950/80 via-purple-950/40 to-slate-900 p-5 rounded-2xl border border-purple-500/30 shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs uppercase tracking-wider font-bold text-purple-300">Pro SaaS Tier</span>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/40 font-mono">$19/mo</span>
            </div>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Unlimited AI post generations, custom agency logos, and automated GitHub Webhook syncing.
            </p>
            <button
              onClick={handleUpgradeToPro}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors shadow"
            >
              Upgrade to Pro 🚀
            </button>
          </div>

          {/* Team / Agency Workspace Switcher */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              🏢 Team Workspaces
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveWorkspace("Personal Dev")}
                className={`flex-1 py-1.5 px-2 text-xs rounded-lg border font-medium transition-all ${
                  activeWorkspace === "Personal Dev" ? "bg-blue-600/20 border-blue-500 text-blue-300" : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                Solo
              </button>
              <button
                onClick={() => setActiveWorkspace("Agency Team")}
                className={`flex-1 py-1.5 px-2 text-xs rounded-lg border font-medium transition-all ${
                  activeWorkspace === "Agency Team" ? "bg-purple-600/20 border-purple-500 text-purple-300" : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                Agency ($49/mo)
              </button>
            </div>
            {activeWorkspace === "Agency Team" && (
              <p className="text-[11px] text-slate-400 font-mono">
                Organization: <span className="text-purple-300 font-bold">DevScale Labs</span> (3 engineers linked)
              </p>
            )}
          </div>

          {/* Card Theme Studio */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3">
              🎨 Card Theme Studio
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <button
                onClick={() => setCardTheme("vscode")}
                className={`p-2 rounded-lg border font-mono text-left ${cardTheme === "vscode" ? "border-blue-500 bg-blue-500/10 text-blue-300" : "border-slate-800 text-slate-400"}`}
              >
                💻 VS Code
              </button>
              <button
                onClick={() => setCardTheme("cyberpunk")}
                className={`p-2 rounded-lg border font-mono text-left ${cardTheme === "cyberpunk" ? "border-pink-500 bg-pink-500/10 text-pink-300" : "border-slate-800 text-slate-400"}`}
              >
                ⚡ Cyberpunk
              </button>
              <button
                onClick={() => setCardTheme("dracula")}
                className={`p-2 rounded-lg border font-mono text-left ${cardTheme === "dracula" ? "border-[#bd93f9] bg-[#bd93f9]/10 text-[#bd93f9]" : "border-slate-800 text-slate-400"}`}
              >
                🧛 Dracula
              </button>
              <button
                onClick={() => setCardTheme("minimal")}
                className={`p-2 rounded-lg border font-mono text-left ${cardTheme === "minimal" ? "border-slate-300 bg-slate-100 text-slate-900" : "border-slate-800 text-slate-400"}`}
              >
                ☀️ Minimal
              </button>
            </div>

            <label className="text-xs text-slate-300 font-medium block mb-1">Custom Brand Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="w-full text-xs text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Output Section */}
      {generatedPost && (
        <div className="mt-8 space-y-6 border-t border-slate-800 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-xs uppercase tracking-wider font-bold text-blue-400 mb-3">
                  Generated Social Post
                </h3>
                <p className="whitespace-pre-wrap text-slate-200 leading-relaxed text-sm font-sans mb-4">
                  {generatedPost}
                </p>
              </div>

              <button
                onClick={handleAddToQueue}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-colors"
              >
                {schedulingSuccess ? "✓ Added to Queue!" : "📅 Queue Post"}
              </button>
            </div>

            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-purple-400">
                    Telemetry Card Graphic
                  </h3>
                  <button
                    onClick={handleDownloadImage}
                    disabled={downloading}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded-lg transition-colors disabled:opacity-50"
                  >
                    {downloading ? "Exporting..." : "📸 Download PNG"}
                  </button>
                </div>

                <div
                  ref={cardRef}
                  className={`p-6 rounded-2xl border ${activeStyle.bg} ${activeStyle.border} shadow-2xl space-y-4`}
                >
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <div className="flex items-center space-x-2">
                      {customLogo ? (
                        <img src={customLogo} alt="Logo" className="w-5 h-5 rounded object-contain" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                      )}
                      <span className="text-xs font-mono text-slate-400">
                        {repoName || "project"}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${activeStyle.badge}`}>
                      {badge || "Dev Grind"}
                    </span>
                  </div>

                  <p className={`text-sm font-medium leading-snug whitespace-pre-wrap ${activeStyle.text}`}>
                    {generatedPost}
                  </p>

                  {hustleScore !== null && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">🔥 Hustle Score</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">{hustleScore}/100</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-red-500 h-2 rounded-full"
                          style={{ width: `${hustleScore}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono italic">{impactSummary}</p>
                    </div>
                  )}

                  {/* Native Sponsorship Footer */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
                    <span>🔨 CommitToPost Telemetry</span>
                    <span className="text-purple-400 font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      ⚡ Sponsored by {sponsorName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}