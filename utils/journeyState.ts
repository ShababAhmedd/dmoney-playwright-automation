import fs from "fs";
import path from "path";
import { NewUser, newAgent } from "./testData";

/**
 * Data handed from one journey (spec file / project) to the next, persisted in
 * .state/journey.json (git-ignored, since the agent's email is a Gmail alias).
 * Journeys run in order via project dependencies in playwright.config.ts.
 */
export interface JourneyState {
  agent: NewUser;
  initialPassword: string;
  agentId?: string;
  customerId?: string;
  customerPhone?: string;
  systemDepositTxnId?: string;
  customerDepositFee?: number;
}

const STATE_FILE = path.resolve(__dirname, "../.state/journey.json");
/** Logged-in agent session saved after the password-reset journey. */
export const AGENT_AUTH_FILE = path.resolve(__dirname, "../playwright/.auth/agent.json");

function writeState(state: JourneyState) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

/** Starts a new journey with a freshly generated agent. */
export function startJourney(): JourneyState {
  const agent = newAgent();
  const state: JourneyState = { agent, initialPassword: agent.password };
  writeState(state);
  return state;
}

export function loadJourney(): JourneyState {
  if (!fs.existsSync(STATE_FILE)) throw new Error("No .state/journey.json — the registration journey must run first");
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

/** Merges `patch` into the saved state and returns the result. */
export function saveJourney(patch: Partial<JourneyState>): JourneyState {
  const state = { ...loadJourney(), ...patch };
  writeState(state);
  return state;
}
