import fs from "fs";
import path from "path";
import { NewUser, newAgent } from "./testData";

/**
 * Data handed from one journey (spec file / project) to the next, persisted in
 * data/users.json next to the Admin and System credentials.
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

const USERS_FILE = path.resolve(__dirname, "../data/users.json");
/** Logged-in agent session saved after the password-reset journey. */
export const AGENT_AUTH_FILE = path.resolve(__dirname, "../playwright/.auth/agent.json");

function readUsers(): Record<string, any> {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeState(state: JourneyState) {
  const { agent } = state;
  const users = {
    Admin: readUsers().Admin,
    System: readUsers().System,
    Agent: {
      Id: state.agentId,
      Name: agent.name,
      Email: agent.email,
      Password: agent.password,
      InitialPassword: state.initialPassword,
      Phone: agent.phone,
      NID: agent.nid,
    },
    Customer: { Id: state.customerId, Phone: state.customerPhone },
    Transactions: {
      SystemDepositTxnId: state.systemDepositTxnId,
      CustomerDepositFee: state.customerDepositFee,
    },
  };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2) + "\n");
}

/** Starts a new journey with a freshly generated agent. */
export function startJourney(): JourneyState {
  const agent = newAgent();
  const state: JourneyState = { agent, initialPassword: agent.password };
  writeState(state);
  return state;
}

export function loadJourney(): JourneyState {
  const { Agent, Customer = {}, Transactions = {} } = readUsers();
  if (!Agent?.Email) throw new Error("No Agent in data/users.json — the registration journey must run first");
  return {
    agent: {
      name: Agent.Name,
      email: Agent.Email,
      password: Agent.Password,
      phone: Agent.Phone,
      nid: Agent.NID,
      role: "Agent",
    },
    initialPassword: Agent.InitialPassword,
    agentId: Agent.Id,
    customerId: Customer.Id,
    customerPhone: Customer.Phone,
    systemDepositTxnId: Transactions.SystemDepositTxnId,
    customerDepositFee: Transactions.CustomerDepositFee,
  };
}

/** Merges `patch` into the saved state and returns the result. */
export function saveJourney(patch: Partial<JourneyState>): JourneyState {
  const state = { ...loadJourney(), ...patch };
  writeState(state);
  return state;
}
