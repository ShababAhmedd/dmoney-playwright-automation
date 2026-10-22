import { faker } from "@faker-js/faker";
import { requireEnv } from "./env";
import users from "../data/users.json";

export interface Credentials {
  email: string;
  password: string;
}

export interface NewUser extends Credentials {
  name: string;
  phone: string;
  nid: string;
  role: "Customer" | "Agent" | "Merchant";
}

export const ADMIN: Credentials = { email: users.Admin.Email, password: users.Admin.Password };
export const SYSTEM: Credentials = { email: users.System.Email, password: users.System.Password };

function uniqueSuffix(): string {
  return `${Date.now()}`.slice(-8) + faker.string.numeric(1);
}

/** Gmail "plus" alias of the inbox the tests read, so OTP/reset emails land there. */
export function gmailAlias(tag: string): string {
  const [local, domain] = requireEnv("GMAIL_ADDRESS").split("@");
  return `${local}+${tag}@${domain}`;
}

export function newAgent(): NewUser {
  const suffix = uniqueSuffix();
  return {
    name: faker.person.fullName(),
    email: gmailAlias(`agent${suffix}`),
    password: "1234",
    phone: `016${suffix.slice(-8)}`,
    nid: faker.string.numeric(10),
    role: "Agent",
  };
}

export const SYSTEM_DEPOSIT = 2000;
export const CUSTOMER_DEPOSIT = 500;
// agents earn a 2.5% commission on every cash in to a customer
export const AGENT_COMMISSION_RATE = 0.025;
// per-transaction cash in limits, checked before the sender's balance
export const MIN_DEPOSIT = 10;
export const MAX_DEPOSIT = 10_000;
export const NON_EXISTENT_PHONE = "01000000001";
export const LOGIN_FAILED = "Login failed. Please input correct email/phone number or password.";
export const DEPOSIT_LIMIT_ERROR = "Minimum deposit amount is 10 tk and maximum deposit amount is 10000 tk";
