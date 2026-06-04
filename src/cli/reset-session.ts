import { resetSession } from "../core/session.js";

export function resetSessionCommand(): void {
  resetSession();
  console.log("Session state cleared.");
}
