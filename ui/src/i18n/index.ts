import i18n from "i18next";
import { initReactI18next } from "react-i18next";
// LanguageDetector removed — it overrides lng setting based on navigator.language
// Language is managed via localStorage("paperclip.language") + LanguageSelector component

// English resources (inlined)
import commonEn from "./locales/en/common.json";
import agentsEn from "./locales/en/agents.json";
import costsEn from "./locales/en/costs.json";
import inboxEn from "./locales/en/inbox.json";
import dashboardEn from "./locales/en/dashboard.json";
import issuesEn from "./locales/en/issues.json";
import projectsEn from "./locales/en/projects.json";
import goalsEn from "./locales/en/goals.json";
import approvalsEn from "./locales/en/approvals.json";
import routinesEn from "./locales/en/routines.json";
import settingsEn from "./locales/en/settings.json";
import onboardingEn from "./locales/en/onboarding.json";
import skillsEn from "./locales/en/skills.json";
import workspacesEn from "./locales/en/workspaces.json";
import pluginsEn from "./locales/en/plugins.json";

// Korean resources (inlined for instant availability)
import commonKo from "./locales/ko/common.json";
import agentsKo from "./locales/ko/agents.json";
import costsKo from "./locales/ko/costs.json";
import inboxKo from "./locales/ko/inbox.json";
import dashboardKo from "./locales/ko/dashboard.json";
import issuesKo from "./locales/ko/issues.json";
import projectsKo from "./locales/ko/projects.json";
import goalsKo from "./locales/ko/goals.json";
import approvalsKo from "./locales/ko/approvals.json";
import routinesKo from "./locales/ko/routines.json";
import settingsKo from "./locales/ko/settings.json";
import onboardingKo from "./locales/ko/onboarding.json";
import skillsKo from "./locales/ko/skills.json";
import workspacesKo from "./locales/ko/workspaces.json";
import pluginsKo from "./locales/ko/plugins.json";

const ns = [
  "common", "agents", "costs", "inbox",
  "dashboard", "issues", "projects", "goals",
  "approvals", "routines", "settings", "onboarding",
  "skills", "workspaces", "plugins",
];

// Resolve language: user preference from localStorage, fallback to en
const savedLang = typeof window !== "undefined"
  ? localStorage.getItem("paperclip.language") ?? "en"
  : "en";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        agents: agentsEn,
        costs: costsEn,
        inbox: inboxEn,
        dashboard: dashboardEn,
        issues: issuesEn,
        projects: projectsEn,
        goals: goalsEn,
        approvals: approvalsEn,
        routines: routinesEn,
        settings: settingsEn,
        onboarding: onboardingEn,
        skills: skillsEn,
        workspaces: workspacesEn,
        plugins: pluginsEn,
      },
      ko: {
        common: commonKo,
        agents: agentsKo,
        costs: costsKo,
        inbox: inboxKo,
        dashboard: dashboardKo,
        issues: issuesKo,
        projects: projectsKo,
        goals: goalsKo,
        approvals: approvalsKo,
        routines: routinesKo,
        settings: settingsKo,
        onboarding: onboardingKo,
        skills: skillsKo,
        workspaces: workspacesKo,
        plugins: pluginsKo,
      },
    },
    ns,
    defaultNS: "common",
    lng: savedLang,
    fallbackLng: "en",
    keySeparator: false,
    interpolation: { escapeValue: false },
  } as Parameters<typeof i18n.init>[0]);

/**
 * Load additional language bundles on demand (for future languages beyond en/ko).
 */
export async function loadLanguage(lng: string): Promise<void> {
  if (lng === "en" || lng === "ko") return; // already inlined

  const modules = import.meta.glob("./locales/**/*.json") as Record<
    string,
    () => Promise<{ default: Record<string, unknown> }>
  >;

  const prefix = `./locales/${lng}/`;
  const loads = Object.entries(modules)
    .filter(([path]) => path.startsWith(prefix))
    .map(async ([path, loader]) => {
      const nsName = path.match(/\/(\w+)\.json$/)?.[1];
      if (!nsName) return;
      const mod = await loader();
      i18n.addResourceBundle(lng, nsName, mod.default, true, true);
    });

  await Promise.all(loads);
}

export default i18n;
