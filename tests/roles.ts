import assert from "node:assert/strict";
import { profileFromDocument } from "../src/lib/profile";
import { dashboardPath, canAccess } from "../src/lib/permissions";

for (const [role, path] of [
  ["director", "/director"], ["manager", "/manager"],
  ["super_admin", "/director"], ["owner", "/director"], ["admin", "/manager"],
  ["team_lead", "/team-lead"], ["team_leader", "/team-lead"], ["leader", "/team-lead"],
  ["employee", "/employee"],
] as const) {
  const profile = profileFromDocument("real-firebase-uid", "new@example.com", { name: "New user", role });
  assert.equal(dashboardPath[profile.role], path);
  assert.equal(profile.id, "real-firebase-uid");
  assert.equal(canAccess(profile, ["director"]), profile.role === "director");
}
for (const role of [undefined, "", "constructor", "__proto__", "unknown-role"]) {
  assert.throws(() => profileFromDocument("uid", "email@example.com", { role }));
}
assert.throws(() => profileFromDocument("uid", null, { role: "manager", active: false }));
assert.equal(profileFromDocument("uid", null, { role: "employee" }).team_id, "");
console.log("PASS: all role mappings, team leader alias, unknown email, invalid roles and disabled profiles.");
