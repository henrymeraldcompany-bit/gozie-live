import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const fixtures = [
  { password: "GOZIE-LIVE-test-password", salt: "00112233445566778899aabbccddeeff" },
  { password: "correct horse battery staple", salt: "ffeeddccbbaa99887766554433221100" },
];

for (const { password, salt } of fixtures) {
  const actual = await pbkdf2Async(sha256, password, salt, {
    c: 310000,
    dkLen: 32,
    asyncTick: 10,
  });
  const expected = pbkdf2Sync(password, salt, 310000, 32, "sha256");
  assert.equal(
    Buffer.from(actual).toString("hex"),
    expected.toString("hex"),
    "Noble PBKDF2 output must match the PBKDF2-HMAC-SHA256 reference output",
  );
}

process.stdout.write("PASS: PBKDF2-SHA256 310000-round compatibility (2 fixtures)\n");
